/** Reproducible offline dubbing. eSpeak is a diagnostic voice adapter, not final editorial TTS. */
import { readFile, writeFile, mkdir, rm, rename, stat, copyFile, constants } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { allDialogue, validateEpisode, type CharacterId, type DialogueLine, type Episode } from '../core/contracts.js';
import { serializeSrt } from '../core/subtitles.js';
import { withinRoot } from '../core/filenames.js';

const SAMPLE_RATE = 24000;
const MAX_TEMPO = 1.2;
const supportedLocales = ['es-ES', 'en-US'] as const;
export type Locale = typeof supportedLocales[number];
export interface Localization { schemaVersion: '1.0'; episodeId: string; locale: Locale; lines: Record<string, string> }
export interface VoiceClipReport { lineId: string; characterId: CharacterId; sourceDurationMs: number; fittedDurationMs: number; windowMs: number; speakingRate: number; tempo: number; clipped: false }
export interface DubManifest { schemaVersion: '1.0'; status: 'LOCALIZED'; episodeId: string; locale: Locale; provider: string; timelineSha256: string; localizationSha256: string; clips: VoiceClipReport[]; files: Record<string,string>; }

export function validateLocalization(input: unknown, episode: Episode, locale: Locale): Localization {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Localization must be an object');
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).sort().join(',') !== 'episodeId,lines,locale,schemaVersion') throw new Error('Unknown or missing localization fields');
  if (raw.schemaVersion !== '1.0' || raw.episodeId !== episode.episodeId || raw.locale !== locale) throw new Error('Localization identity/version mismatch');
  const lines = raw.lines;
  if (!lines || typeof lines !== 'object' || Array.isArray(lines)) throw new Error('Localization lines must be an object');
  const expected = allDialogue(episode).map(line => line.lineId).sort();
  const actual = Object.keys(lines).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Localization must cover exactly the source line IDs');
  for (const [id, text] of Object.entries(lines)) {
    if (typeof text !== 'string' || !text.trim() || text.length > 1000 || /[\u0000-\u0008\u000B-\u001F]/.test(text)) throw new Error(`Invalid localized line: ${id}`);
  }
  return input as Localization;
}

/** Never invoke shell. Text is passed as exactly one argument. */
export async function runTool(exe: string, args: string[], timeoutMs = 120_000): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(exe, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', error = '', settled = false;
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(new Error(`${exe} timed out`)); }, timeoutMs);
    const finish = (problem?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (problem) reject(problem); else resolvePromise(output);
    };
    child.stdout.on('data', (buffer: Buffer) => { output = (output + buffer.toString()).slice(-1_000_000); });
    child.stderr.on('data', (buffer: Buffer) => { error = (error + buffer.toString()).slice(-8_000); });
    child.once('error', err => finish(err));
    child.once('close', code => finish(code === 0 ? undefined : new Error(`${exe} exited ${code}: ${error}`)));
  });
}

function clipVoice(locale: Locale, speaker: CharacterId): string {
  return `${locale === 'es-ES' ? 'es' : 'en-us'}+${speaker === 'vera' ? 'f3' : 'm3'}`;
}

async function durationMs(wav: string): Promise<number> {
  const result = JSON.parse(await runTool('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', wav])) as {format: {duration: string}};
  const ms = Math.round(Number(result.format.duration) * 1000);
  if (!Number.isSafeInteger(ms) || ms <= 0) throw new Error(`TTS returned invalid duration: ${wav}`);
  return ms;
}

function pcmWave(samples: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(samples.length + 36, 4);
  header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24); header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}

async function exist(filename: string): Promise<boolean> { try { await stat(filename); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; } }
const hash = (buffer: Buffer | string): string => createHash('sha256').update(buffer).digest('hex');

/** Fail closed on duration overflow. Never truncate and never silently change the timeline. */
export async function dubEpisode(episodeInput: Episode, localizationInput: unknown, locale: Locale, root = resolve(process.cwd())): Promise<DubManifest> {
  const episode = validateEpisode(episodeInput);
  const localization = validateLocalization(localizationInput, episode, locale);
  const base = withinRoot(root, join('productions', episode.episodeId));
  const finalDir = withinRoot(base, join('locales', locale));
  const completed = join(finalDir, 'dub-manifest.json');
  const jsonDigest = hash(JSON.stringify(episode));
  const localeDigest = hash(JSON.stringify(localization));
  if (await exist(completed)) {
    const prev = JSON.parse(await readFile(completed, 'utf8')) as DubManifest;
    if (prev.timelineSha256 !== jsonDigest || prev.localizationSha256 !== localeDigest) throw new Error('Inputs changed; existing localized artifact cannot be reused');
    for (const [name, digest] of Object.entries(prev.files)) {
      const actual = hash(await readFile(join(finalDir, name)));
      if (actual !== digest) throw new Error(`Localized artifact has been modified: ${name}`);
    }
    return prev;
  }
  // Avoid partial output: all work happens under a unique, temporary directory.
  const tmp = withinRoot(root, join('workspace', 'temp', `${episode.episodeId}-${locale}-${process.pid}-${Date.now()}`));
  await mkdir(tmp, {recursive:true});
  const clips: VoiceClipReport[] = [];
  try {
    const audio = Buffer.alloc(Math.ceil(episode.durationMs * SAMPLE_RATE / 1000) * 2);
    const rendered: DialogueLine[] = [];
    for (const line of allDialogue(episode)) {
      const text = localization.lines[line.lineId]!;
      const allowedMs = line.endMs - line.startMs;
      const source = join(tmp, `${line.lineId}.wav`);
      let duration = 0;
      let speakingRate = 205;
      for (const rate of [205, 230, 250, 270]) {
        speakingRate = rate;
        await runTool('espeak', ['-v', clipVoice(locale, line.characterId), '-s', String(rate), '-w', source, text]);
        duration = await durationMs(source);
        if (duration <= allowedMs * MAX_TEMPO) break;
      }
      const tempo = Math.max(1, duration / allowedMs);
      if (tempo > MAX_TEMPO + .00001) throw new Error(`${line.lineId} exceeds ${allowedMs}ms dialogue window; measured ${duration}ms at max voice speed. Rewrite line or refreeze timeline.`);
      const pcm = join(tmp, `${line.lineId}.pcm`);
      await runTool('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', source, '-af', `atempo=${tempo.toFixed(5)},aresample=${SAMPLE_RATE}`, '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', pcm]);
      const raw = await readFile(pcm);
      const samples = Math.floor(raw.length / 2);
      const offset = Math.round(line.startMs * SAMPLE_RATE / 1000);
      const permitted = Math.round(allowedMs * SAMPLE_RATE / 1000);
      if (samples > permitted + 3) throw new Error(`${line.lineId} audio exceeds window after tempo fit`);
      for (let i = 0; i < samples; i++) {
        const envelope = Math.min(1, i / (SAMPLE_RATE * .012), (samples - i - 1) / (SAMPLE_RATE * .012));
        const sample = Math.round(raw.readInt16LE(i * 2) * envelope * .66);
        const dest = (offset + i) * 2;
        if (dest + 1 >= audio.length) throw new Error(`Audio beyond episode: ${line.lineId}`);
        const mixed = Math.max(-32768, Math.min(32767, audio.readInt16LE(dest) + sample));
        audio.writeInt16LE(mixed, dest);
      }
      await rm(pcm,{force:true}); // PCM is a scratch intermediate; keep the source WAV for selective regeneration.
      clips.push({lineId:line.lineId, characterId:line.characterId, sourceDurationMs:duration, fittedDurationMs:Math.round(samples * 1000 / SAMPLE_RATE), windowMs:allowedMs, speakingRate, tempo:Number(tempo.toFixed(5)), clipped:false});
      rendered.push({...line, text});
    }
    await writeFile(join(tmp, 'dialogue.wav'), pcmWave(audio));
    await writeFile(join(tmp, 'full_audio.wav'), pcmWave(audio));
    for (const actor of ['vera', 'leo'] as const) await writeFile(join(tmp, `${actor}.srt`), serializeSrt(rendered.filter(line => line.characterId === actor)));
    await writeFile(join(tmp, 'combined.srt'), serializeSrt(rendered, true));
    await writeFile(join(tmp, 'speech-fit-report.json'), JSON.stringify({schemaVersion:'1.0', provider:'espeak-diagnostic', locale, clips}, null, 2)+'\n');
    const fileNames = ['dialogue.wav','full_audio.wav','vera.srt','leo.srt','combined.srt','speech-fit-report.json',...clips.map(c=>`${c.lineId}.wav`)];
    const files: Record<string,string> = {};
    for (const name of fileNames) files[name] = hash(await readFile(join(tmp, name)));
    const manifest: DubManifest = {schemaVersion:'1.0',status:'LOCALIZED',episodeId:episode.episodeId,locale, provider:'espeak-diagnostic', timelineSha256:jsonDigest,localizationSha256:localeDigest,clips,files};
    await writeFile(join(tmp, 'dub-manifest.json'), JSON.stringify(manifest,null,2)+'\n');
    await mkdir(dirname(finalDir),{recursive:true});
    if (await exist(finalDir)) {
      // SRTs may already have been exported by the renderer. Preserve identical files.
      // Refuse conflicting content instead of overwriting a validated artifact.
      for (const name of [...fileNames, 'dub-manifest.json']) {
        const dest = join(finalDir, name);
        const staged = await readFile(join(tmp, name));
        if (await exist(dest) && !staged.equals(await readFile(dest))) throw new Error(`Conflict with existing localized artifact: ${dest}`);
      }
      for (const name of [...fileNames, 'dub-manifest.json']) {
        if (!(await exist(join(finalDir,name)))) await copyFile(join(tmp,name),join(finalDir,name),constants.COPYFILE_EXCL);
      }
    } else await rename(tmp, finalDir);
    return manifest;
  } finally { await rm(tmp,{force:true,recursive:true}); }
}

/** Mux the same silent master with a localized audio stem. Never re-render scene frames. */
export async function muxDubbedVideo(episode: Episode, locale: Locale, preset: 'preview' | 'final' = 'preview', root = resolve(process.cwd())): Promise<string> {
  const base = withinRoot(root, join('productions', episode.episodeId));
  const master = join(base, preset, 'silent.mp4');
  const localeDir = join(base, 'locales', locale);
  const manifest = JSON.parse(await readFile(join(localeDir, 'dub-manifest.json'), 'utf8')) as DubManifest;
  if (manifest.timelineSha256 !== hash(JSON.stringify(validateEpisode(episode)))) throw new Error('Timeline changed after dub');
  const output = join(localeDir, `final_${preset}.mp4`);
  const verificationFile = join(localeDir, `mux_${preset}.json`);
  const inputHash = hash(`${hash(await readFile(master))}:${hash(await readFile(join(localeDir,'full_audio.wav')))}:${manifest.timelineSha256}`);
  if (await exist(output)) {
    if (!(await exist(verificationFile))) throw new Error(`Video exists without verifiable mux manifest: ${output}`);
    const previous=JSON.parse(await readFile(verificationFile,'utf8')) as {inputHash:string;outputHash:string};
    if (previous.inputHash !== inputHash || previous.outputHash !== hash(await readFile(output))) throw new Error('Mux inputs or output changed; create a new revision');
    return output;
  }
  const tmp = `${output}.${process.pid}.tmp.mp4`;
  try {
    await runTool('ffmpeg', ['-hide_banner','-loglevel','error','-nostdin','-y','-i',master,'-i',join(localeDir,'full_audio.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k','-t',(episode.durationMs/1000).toString(),'-movflags','+faststart',tmp],600_000);
    const raw = await runTool('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name','-show_entries','format=duration','-of','json',tmp]);
    const result = JSON.parse(raw) as {streams:{codec_type:string}[];format:{duration:string}};
    if (!result.streams.some(s=>s.codec_type==='video') || !result.streams.some(s=>s.codec_type==='audio') || Math.abs(Number(result.format.duration) - episode.durationMs/1000) > .06) throw new Error('Muxed video fails media QA');
    const outputHash=hash(await readFile(tmp));
    await rename(tmp,output);
    await writeFile(verificationFile,JSON.stringify({schemaVersion:'1.0',preset,episodeId:episode.episodeId,locale,inputHash,outputHash,durationMs:episode.durationMs,technicalPass:true},null,2)+'\n',{flag:'wx'});
    return output;
  } finally {await rm(tmp,{force:true});}
}

export function sourceLocalization(episode: Episode): Localization {
  return {schemaVersion:'1.0',episodeId:episode.episodeId,locale:'es-ES',lines:Object.fromEntries(allDialogue(episode).map(l => [l.lineId,l.text]))};
}
