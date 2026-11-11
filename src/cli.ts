#!/usr/bin/env node
/** AnyMotion operator CLI: explicit outputs, no external API calls or publishing. */
import { readFile, writeFile, mkdir, rm, rename, stat } from 'node:fs/promises';
import { resolve, basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { validateEpisode, type Episode } from './core/contracts.js';
import { createSubtitles } from './core/subtitles.js';
import { frameCount } from './core/timing.js';
import { withinRoot } from './core/filenames.js';
import { renderSvgFrame } from './renderer/scene.js';

const ROOT = resolve(process.cwd());
const TEMP_ROOT = resolve(ROOT, 'workspace', 'temp');
const OUTPUT_ROOT = resolve(ROOT, 'productions');
const presets = { preview: { fps: 12, width: 640, height: 360, crf: 24 }, final: { fps: 30, width: 1920, height: 1080, crf: 19 } } as const;

async function executable(binary: string, args: string[]): Promise<string> {
  return new Promise((ok, fail) => {
    const child = spawn(binary, args, { shell: false, windowsHide: true });
    let output = '';
    let error = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { error += chunk.toString(); if (error.length > 15000) error = error.slice(-15000); });
    child.once('error', fail);
    child.once('close', code => code === 0 ? ok(output || error) : fail(new Error(`${binary} exited ${code}: ${error.slice(-4000)}`)));
  });
}

async function loadEpisode(filename: string): Promise<Episode> {
  const content = await readFile(resolve(ROOT, filename), 'utf8');
  return validateEpisode(JSON.parse(content) as unknown);
}

function outputFolder(episode: Episode, preset: string): string {
  return withinRoot(OUTPUT_ROOT, join(episode.episodeId, preset));
}

async function exportSrt(episode: Episode): Promise<string[]> {
  const localeDir = withinRoot(OUTPUT_ROOT, join(episode.episodeId, 'locales', episode.sourceLocale));
  await mkdir(localeDir, { recursive: true });
  const subtitles = createSubtitles(episode);
  const files: string[] = [];
  for (const [speaker, content] of Object.entries(subtitles)) {
    const file = join(localeDir, `${speaker}.srt`);
    try { const existing = await readFile(file, 'utf8'); if (existing !== content) throw new Error(`SRT already exists with different contents: ${file}. Version the source episode instead.`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') await writeFile(file, content, 'utf8'); else throw error; }
    files.push(file);
  }
  return files;
}

async function doctor(): Promise<void> {
  console.log(`Node ${process.version}`);
  const checks: { name: string; cmd: string; args: string[]; test: RegExp }[] = [
    { name: 'FFmpeg', cmd: 'ffmpeg', args: ['-hide_banner', '-version'], test: /ffmpeg version/i },
    { name: 'FFprobe', cmd: 'ffprobe', args: ['-hide_banner', '-version'], test: /ffprobe version/i },
    { name: 'SVG decoder', cmd: 'ffmpeg', args: ['-hide_banner', '-decoders'], test: /librsvg/ },
    { name: 'H264 encoder', cmd: 'ffmpeg', args: ['-hide_banner', '-encoders'], test: /libx264/ },
  ];
  let failures = 0;
  for (const check of checks) {
    try {
      const output = await executable(check.cmd, check.args);
      const pass = check.test.test(output);
      console.log(`${pass ? 'PASS' : 'FAIL'} ${check.name}`);
      if (!pass) failures++;
    } catch (error) { console.error(`FAIL ${check.name}: ${String(error)}`); failures++; }
  }
  if (failures) throw new Error(`${failures} preflight checks failed`);
}

async function sha256(path: string): Promise<string> { return createHash('sha256').update(await readFile(path)).digest('hex'); }

async function render(episode: Episode, preset: keyof typeof presets): Promise<void> {
  await doctor();
  const config = presets[preset];
  const n = frameCount(episode.durationMs, config.fps);
  const outputDir = outputFolder(episode, preset);
  const output = join(outputDir, 'silent.mp4');
  const workDir = withinRoot(TEMP_ROOT, `${episode.episodeId}-${preset}-${process.pid}-${Date.now()}`);
  await mkdir(outputDir, { recursive: true });
  try { await stat(output); throw new Error(`Output already exists: ${output}. Explicitly archive it before rendering a new revision.`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await mkdir(workDir, { recursive: true });
  const started = performance.now();
  try {
    console.log(`Rendering ${episode.episodeId}: ${n} SVG frames, ${config.width}x${config.height}, ${config.fps} FPS`);
    for (let frame = 0; frame < n; frame++) {
      const filename = join(workDir, `frame_${String(frame).padStart(6, '0')}.svg`);
      await writeFile(filename, renderSvgFrame(episode, frame, config.fps, config.width, config.height));
      if ((frame + 1) % Math.max(1, Math.floor(n / 5)) === 0) console.log(`Generated ${frame + 1}/${n} frames`);
    }
    const tempMp4 = join(workDir, 'rendering.mp4');
    await executable('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-framerate', String(config.fps), '-i', join(workDir, 'frame_%06d.svg'),
      '-frames:v', String(n), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(config.crf),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tempMp4,
    ]);
    const probe = await executable('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,duration', '-show_entries', 'format=duration', '-of', 'json', tempMp4]);
    const data = JSON.parse(probe) as { streams?: Array<{ codec_name: string; width: number; height: number; avg_frame_rate: string }>; format?: { duration: string } };
    const video = data.streams?.[0];
    const measuredDuration = Number(data.format?.duration);
    if (!video || video.codec_name !== 'h264' || video.width !== config.width || video.height !== config.height || Math.abs(measuredDuration - episode.durationMs / 1000) > (1 / config.fps + .01)) throw new Error(`Media QA failed: ${probe}`);
    await rename(tempMp4, output);
    const subtitles = await exportSrt(episode);
    const elapsedMs = Math.round(performance.now() - started);
    const manifest = {
      schemaVersion: '1.0', episodeId: episode.episodeId, status: 'MASTER_RENDERED', editorialApproved: false,
      preset, renderer: 'svg-ffmpeg-poc', frames: n, fps: config.fps, canvas: { width: config.width, height: config.height },
      durationMs: episode.durationMs, renderElapsedMs: elapsedMs,
      artifacts: [{ path: output.slice(ROOT.length + 1), sha256: await sha256(output) }, ...(await Promise.all(subtitles.map(async file => ({ path: file.slice(ROOT.length + 1), sha256: await sha256(file) }))))],
    };
    await writeFile(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(join(outputDir, 'quality-report.json'), JSON.stringify({
      schemaVersion: '1.0', episodeId: episode.episodeId, technicalPass: true, editorialApproved: false,
      checks: { validatedContract: true, mediaProbe: video, durationMsMeasured: Math.round(measuredDuration * 1000), perSpeakerSrt: true, uniqueMaster: true },
    }, null, 2) + '\n');
    console.log(`PASS: ${output}\nSRT: ${subtitles.map(f => basename(f)).join(', ')}\nElapsed: ${(elapsedMs / 1000).toFixed(1)}s`);
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
}

async function main(): Promise<void> {
  const [command, file, ...args] = process.argv.slice(2);
  if (command === 'doctor') return doctor();
  if (!command || !['validate', 'subtitles', 'render'].includes(command) || !file) {
    console.log('Usage:\n  node dist/cli.js doctor\n  node dist/cli.js validate examples/pilot.json\n  node dist/cli.js subtitles examples/pilot.json\n  node dist/cli.js render examples/pilot.json --preset preview|final');
    process.exitCode = 2; return;
  }
  const episode = await loadEpisode(file);
  if (command === 'validate') { console.log(`PASS ${episode.episodeId}: ${episode.scenes.length} scenes, ${episode.durationMs}ms`); return; }
  if (command === 'subtitles') { const files = await exportSrt(episode); console.log(files.join('\n')); return; }
  if (args.length !== 2 || args[0] !== '--preset' || !['preview', 'final'].includes(args[1] ?? '')) throw new Error('Render requires --preset preview|final');
  await render(episode, args[1] as keyof typeof presets);
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
