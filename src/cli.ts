#!/usr/bin/env node
/** AnyMotion operator CLI: explicit outputs, no external API calls or publishing. */
import { readFile, writeFile, mkdir, rm, rename, stat } from 'node:fs/promises';
import { resolve, basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { validateEpisode, type Episode } from './core/contracts.js';
import { createSubtitles } from './core/subtitles.js';
import {createSoundscape} from './audio/soundscape.js';
import { frameCount } from './core/timing.js';
import { withinRoot } from './core/filenames.js';
import { renderSvgFrame } from './renderer/scene.js';
import { dubEpisode, muxDubbedVideo, sourceLocalization, runTool, type Locale } from './audio/dubbing.js';
import { configuredHttpTts } from './audio/tts-http.js';
import { packageEpisode } from './production/package.js';
import { ProductionJobStore, isRetryableJobError, type JobSpec } from './production/jobs.js';
import { generateDraftFile, OpenAICompatibleStoryProvider, validateStoryBrief } from './story/llm.js';
import { prepareEpisodeDrafts } from './production/autopilot.js';
import { freezeTimeline } from './timeline/freeze.js';
import { generateLocalizationFile } from './story/localizer.js';
import { verifyMaster } from './production/master.js';
import { approveEditorial, verifyEditorialApproval, verifiedRelease } from './publishing/approval.js';
import { uploadPrivateVideo, validateVideoMetadata } from './publishing/youtube.js';
import {acquireYouTubeAccessToken,credentialsFromEnvironment} from './publishing/oauth.js';
import {makeThumbnail} from './production/thumbnail.js';
import {uploadApprovedThumbnail} from './publishing/thumbnail-upload.js';
import {backupEpisode,restoreEpisodeBackup,verifyEpisodeBackup} from './production/backup.js';
import {startStudioServer} from './studio/server.js';
import {scheduleApprovedVideo} from './publishing/schedule.js';
import {analyzeEditorial} from './quality/editorial.js';
import {createStagedStory} from './story/staged.js';
import {startStagedProviderSession} from './story/checkpoints.js';
import {createStudioKit} from './publishing/kit.js';
import {analyzeBusiness} from './analytics/report.js';

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
      durationMs: episode.durationMs, sourceHash: createHash('sha256').update(JSON.stringify(episode)).digest('hex'), renderElapsedMs: elapsedMs,
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

function parseArgs(args: string[], valid: string[]): Record<string,string> {
  if(args.length%2!==0)throw new Error('Option flags require values');
  const options:Record<string,string>={};
  for(let i=0;i<args.length;i+=2){
    const name=args[i]!,value=args[i+1]!;
    if(!valid.includes(name)||name in options)throw new Error(`Unknown/duplicate option: ${name}`);
    options[name]=value;
  }
  return options;
}

async function localizationFile(episode: Episode,locale: Locale,filename?:string):Promise<unknown>{
  if(locale==='es-ES'){
    if(filename)throw new Error('Do not supply a translation for the source locale');
    return sourceLocalization(episode);
  }
  if(!filename)throw new Error('English requires --translation with manually reviewed localized lines');
  return JSON.parse(await readFile(resolve(ROOT,filename),'utf8')) as unknown;
}

async function executeStage<T>(db: ProductionJobStore, spec:JobSpec, work:()=>Promise<T>, outputHash:(value:T)=>Promise<string>):Promise<T>{
  const leaseMs=90_000;
  const claimed=db.claim(spec,leaseMs);
  if(!claimed){
    const existing=db.get(spec);
    if(existing?.status!=='SUCCEEDED')throw new Error(`Stage ${spec.stage}/${spec.locale??''} is locked or blocked: ${existing?.status}`);
    // Re-run only idempotent verification paths, not the rendering itself.
    return work();
  }
  let leaseLost=false;
  const heartbeat=setInterval(()=>{try{if(!db.heartbeat(spec,claimed.owner,leaseMs))leaseLost=true;}catch{leaseLost=true;}},15_000);
  heartbeat.unref();
  try{
    const result=await work();
    if(leaseLost)throw new Error('Job lease was lost during stage execution');
    db.succeed(spec,claimed.owner,await outputHash(result));
    return result;
  }catch(error){if(!leaseLost)db.fail(spec,claimed.owner,error instanceof Error?error.message:String(error),isRetryableJobError(error));throw error;}
  finally{clearInterval(heartbeat);}
}

async function main(): Promise<void> {
  const [command, file, ...args] = process.argv.slice(2);
  if (command === 'doctor') return doctor();
  if (command === 'studio') {
    const port=process.env.ANYMOTION_STUDIO_PORT?Number(process.env.ANYMOTION_STUDIO_PORT):4321;
    const service=await startStudioServer(ROOT,port);
    console.log(`AnyMotion Studio (solo lectura) http://127.0.0.1:${service.port}`);
    return;
  }
  if (!command || !['validate','subtitles','render','dub','mux','package','pipeline','jobs','generate','localize','editorial-check','editorial-approve','youtube-private','backup','backup-verify','restore','thumbnail','youtube-thumbnail','youtube-schedule','editorial-analyze','generate-staged','youtube-kit','autopilot','soundtrack','analytics'].includes(command) || !file) {
    console.log(`Usage:
  node dist/cli.js doctor
  node dist/cli.js studio
  node dist/cli.js analytics examples/analytics.simulated.json --out workspace/analytics-demo.json
  node dist/cli.js validate examples/pilot.json
  node dist/cli.js subtitles examples/pilot.json
  node dist/cli.js render examples/pilot.json --preset preview|final
  node dist/cli.js soundtrack examples/pilot.json --design examples/pilot.sound-design.json
  node dist/cli.js dub examples/pilot.json --locale es-ES|en-US [--translation examples/pilot.en-US.json]
  node dist/cli.js mux examples/pilot.json --locale es-ES|en-US --preset preview|final
  node dist/cli.js pipeline examples/pilot.json --preset preview|final --translation-en examples/pilot.en-US.json [--sound-design examples/pilot.sound-design.json]
  node dist/cli.js jobs examples/pilot.json
  node dist/cli.js generate examples/story-brief.json --out examples/new-episode.json
  node dist/cli.js localize examples/pilot.json --locale en-US --out examples/EP0001.en-US.draft.json
  node dist/cli.js backup examples/pilot.json --to /external/archive
  node dist/cli.js backup-verify examples/pilot.json --from /external/archive
  node dist/cli.js restore examples/pilot.json --from /external/archive
  node dist/cli.js editorial-check examples/pilot.json
  node dist/cli.js editorial-approve examples/pilot.json --reviewer Producer --notes-file review.txt --rights-confirmed yes --confirm APPROVE:EP0001
  node dist/cli.js youtube-private examples/pilot.json --metadata examples/youtube-metadata.example.json --confirm UPLOAD_PRIVATE:EP0001
  node dist/cli.js autopilot examples/story-brief.json --confirm GENERATE_PREVIEW:EP0003
  node dist/cli.js thumbnail examples/pilot.json --frame-ms 35000
  node dist/cli.js youtube-thumbnail examples/pilot.json --confirm UPLOAD_THUMBNAIL:EP0001
  node dist/cli.js youtube-schedule examples/pilot.json --metadata examples/youtube-metadata.example.json --publish-at 2027-01-01T18:00:00Z --confirm SCHEDULE:EP0001:2027-01-01T18:00:00Z
  node dist/cli.js editorial-analyze examples/pilot.json
  node dist/cli.js generate-staged examples/story-brief.json --out workspace/new-episode.json --confirm GENERATE_STAGED:EP0002
  node dist/cli.js youtube-kit examples/pilot.json --metadata examples/youtube-metadata.example.json`);
    process.exitCode = 2; return;
  }
  if(command==='analytics'){
    const o=parseArgs(args,['--out']);
    if(!o['--out'])throw new Error('analytics requires explicit --out file path');
    const source=withinRoot(ROOT,file);
    const target=withinRoot(ROOT,o['--out']);
    const record=JSON.parse(await readFile(source,'utf8')) as unknown;
    const report=analyzeBusiness(record);
    await mkdir(resolve(target,'..'),{recursive:true});
    await writeFile(target,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log(`ANALYTICS ${report.status}: ${report.episodes} episodes, ${report.views} views; no auto-scale decision. ${target}`);
    return;
  }
  if(command==='localize'){
    const o=parseArgs(args,['--locale','--out']);
    if(o['--locale']!=='en-US'||!o['--out'])throw new Error('localize needs --locale en-US --out path');
    const result=await generateLocalizationFile(file,'en-US',o['--out']);
    console.log(`LOCALIZATION_DRAFT ${result.episodeId}: ${Object.keys(result.lines).length} lines. Human review required.`);return;
  }
  if(command==='autopilot'){
    const o=parseArgs(args,['--confirm']);
    const brief=validateStoryBrief(JSON.parse(await readFile(resolve(ROOT,file),'utf8')) as unknown);
    if(o['--confirm']!==`GENERATE_PREVIEW:${brief.episodeId}`)throw new Error('Autopilot requires exact episode confirmation before LLM calls');
    const model=process.env.ANYMOTION_LLM_MODEL,key=process.env.ANYMOTION_LLM_API_KEY,endpoint=process.env.ANYMOTION_LLM_ENDPOINT;
    if(!model||!key||!endpoint)throw new Error('Autopilot requires LLM endpoint/model/key; no paid requests were made');
    // Fail early on local media/TTS prerequisites rather than spending LLM tokens and then discovering a missing renderer.
    await doctor();
    if(process.env.ANYMOTION_TEST_VOICE!=='synthetic'&&!configuredHttpTts())
      await runTool('espeak',['--version'],5000).catch(()=>{throw new Error('No configured HTTP TTS or eSpeak diagnostic tool; LLM calls were not made');});
    const provider=new OpenAICompatibleStoryProvider({model,apiKey:key,endpoint});
    const draft=await prepareEpisodeDrafts(brief,provider,ROOT);
    console.log(`DRAFTS_READY ${brief.episodeId}; LLM calls this run: ${draft.llmCallsThisRun}; status EDITORIAL_PENDING`);
    const log=await executable(process.execPath,[resolve(ROOT,'dist','cli.js'),'pipeline',draft.episodePath,'--preset','preview','--translation-en',draft.localizationPath]);
    console.log(log);
    console.log(`PREVIEW_READY ${brief.episodeId}; DIAGNOSTIC ONLY. Human script, art, voice and rights review needed.`);
    return;
  }
  if(command==='generate-staged'){
    const opts=parseArgs(args,['--out','--confirm']);
    const brief=validateStoryBrief(JSON.parse(await readFile(resolve(ROOT,file),'utf8')) as unknown);
    if(!opts['--out']||opts['--confirm']!==`GENERATE_STAGED:${brief.episodeId}`)throw new Error('Staged LLM generation requires --out and exact confirmation');
    const output=withinRoot(ROOT,opts['--out']);
    const outlineOutput=withinRoot(ROOT,opts['--out']+'.outline.json');
    for(const destination of [output,outlineOutput]){
      try{await stat(destination);throw new Error(`Output already exists: ${destination}`);}
      catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    }
    const model=process.env.ANYMOTION_LLM_MODEL,key=process.env.ANYMOTION_LLM_API_KEY,endpoint=process.env.ANYMOTION_LLM_ENDPOINT;
    if(!model||!key||!endpoint)throw new Error('Staged generation needs explicit LLM model/key/endpoint');
    const session=await startStagedProviderSession(brief,new OpenAICompatibleStoryProvider({model,apiKey:key,endpoint}),ROOT);
    let generated;
    try{generated=await createStagedStory(brief,session.provider);}
    finally{await session.close();}
    console.log(`LLM requests actually billed this run: ${session.calls()}`);
    await mkdir(resolve(output,'..'),{recursive:true});
    await writeFile(outlineOutput,JSON.stringify(generated.outline,null,2)+'\n',{flag:'wx'});
    await writeFile(output,JSON.stringify(generated.episode,null,2)+'\n',{flag:'wx'});
    console.log(`STAGED_DRAFT_READY ${brief.episodeId}: ${generated.episode.scenes.length} scenes, ${generated.llmCalls} LLM calls. EDITORIAL_PENDING.`);return;
  }
  if(command==='generate') {
    const o=parseArgs(args,['--out']);
    if(!o['--out'])throw new Error('generate requires --out path');
    const result=await generateDraftFile(file,o['--out']);
    console.log(`DRAFT ${result.episode.episodeId}; model=${result.model}; warnings=${result.warnings.join(';')||'none'}. Human editorial approval required.`);return;
  }
  const episode = await loadEpisode(file);
  if (command === 'editorial-analyze') {
    const opts=parseArgs(args,['--prior']);
    const prior=opts['--prior']?JSON.parse(await readFile(resolve(ROOT,opts['--prior']),'utf8')) as unknown:[];
    if(!Array.isArray(prior))throw new Error('--prior expects an array of prior episode summaries');
    console.log(JSON.stringify(analyzeEditorial(episode,prior as string[]),null,2));return;
  }
  if (command === 'validate') { console.log(`PASS ${episode.episodeId}: ${episode.scenes.length} scenes, ${episode.durationMs}ms`); return; }
  if (command === 'subtitles') { const files = await exportSrt(episode); console.log(files.join('\n')); return; }
  if(command==='soundtrack'){
    const o=parseArgs(args,['--design']);
    if(!o['--design'])throw new Error('Soundtrack requires --design JSON');
    const design=JSON.parse(await readFile(resolve(ROOT,o['--design']),'utf8')) as unknown;
    const result=await createSoundscape(episode,design);
    console.log(`SOUNDSCAPE_READY ${result.episodeId}: music.wav, sfx.wav; original procedural source`);return;
  }
  if(command==='backup'||command==='backup-verify'||command==='restore'){
    const o=parseArgs(args,command==='backup'?['--to']:['--from']);
    const location=command==='backup'?o['--to']:o['--from'];
    if(!location)throw new Error(`Missing backup location for ${command}`);
    const archive=resolve(ROOT,location);
    const result=command==='backup'?await backupEpisode(episode,archive):
      command==='backup-verify'?await verifyEpisodeBackup(episode,archive):await restoreEpisodeBackup(episode,archive);
    console.log(`${command.toUpperCase()} ${result.episodeId}: ${Object.keys(result.files).length} verified files; revision=${result.episodeSha256}`);
    return;
  }
  if(command==='thumbnail'){
    const o=parseArgs(args,['--frame-ms']);
    if(!o['--frame-ms']||!/^[0-9]+$/.test(o['--frame-ms']))throw new Error('Thumbnail requires integer --frame-ms');
    const result=await makeThumbnail(episode,Number(o['--frame-ms']));
    console.log(`THUMBNAIL_READY ${result.episodeId}: frame ${result.frameMs}ms; SHA-256 ${result.imageHash}`);return;
  }
  if(command==='editorial-check'){
    try{
      const release=await verifiedRelease(episode,'final');
      try{const approval=await verifyEditorialApproval(episode);console.log(JSON.stringify({releaseHash:release.sha256,status:approval.status},null,2));}
      catch(e){console.log(JSON.stringify({releaseHash:release.sha256,status:'EDITORIAL_PENDING',blocker:e instanceof Error?e.message:String(e)},null,2));}
    }catch(e){
      console.log(JSON.stringify({episodeId:episode.episodeId,status:'FINAL_RELEASE_NOT_READY',blocker:e instanceof Error?e.message:String(e)},null,2));
    }
    return;
  }
  if(command==='editorial-approve'){
    const o=parseArgs(args,['--reviewer','--notes-file','--rights-confirmed','--confirm']);
    if(!o['--notes-file'])throw new Error('Editorial approval requires --notes-file');
    const decision=await approveEditorial(episode,{reviewer:o['--reviewer']??'',reviewNotes:await readFile(resolve(ROOT,o['--notes-file']),'utf8'),confirm:o['--confirm']??'',commercialRightsConfirmed:o['--rights-confirmed']==='yes'});
    console.log(`EDITORIAL_APPROVED ${decision.episodeId} for release ${decision.releaseSha256}`);return;
  }
  if(command==='youtube-kit'){
    const opts=parseArgs(args,['--metadata']);
    if(!opts['--metadata'])throw new Error('Studio publishing kit requires --metadata JSON');
    const metadata=validateVideoMetadata(JSON.parse(await readFile(resolve(ROOT,opts['--metadata']),'utf8')) as unknown);
    const result=await createStudioKit({episode,metadata});
    console.log(`STUDIO_KIT_READY ${result.manifest.revision}: ${Object.keys(result.manifest.files).length} verified files at ${result.dir}`);return;
  }
  if(command==='youtube-schedule'){
    const opts=parseArgs(args,['--metadata','--publish-at','--confirm']);
    if(!opts['--metadata']||!opts['--publish-at']||opts['--confirm']!==`SCHEDULE:${episode.episodeId}:${opts['--publish-at']}`)
      throw new Error('YouTube scheduling requires --metadata, --publish-at UTC and exact --confirm SCHEDULE:EPID:TIME');
    const metadata=validateVideoMetadata(JSON.parse(await readFile(resolve(ROOT,opts['--metadata']),'utf8')) as unknown);
    const token=await acquireYouTubeAccessToken(credentialsFromEnvironment());
    const result=await scheduleApprovedVideo({episode,metadata,publishAt:opts['--publish-at'],accessToken:token,confirm:opts['--confirm']});
    console.log(`SCHEDULED ${result.videoId} at ${result.publishAt}; verified private until publication time`);return;
  }
  if(command==='youtube-thumbnail'){
    const o=parseArgs(args,['--confirm']);
    if(o['--confirm']!==`UPLOAD_THUMBNAIL:${episode.episodeId}`)throw new Error('Explicit thumbnail confirmation required before OAuth');
    const token=await acquireYouTubeAccessToken(credentialsFromEnvironment());
    const result=await uploadApprovedThumbnail({episode,accessToken:token,confirm:o['--confirm']});
    console.log(`THUMBNAIL_UPLOADED ${result.episodeId} for private video ${result.videoId}`);return;
  }
  if(command==='youtube-private'){
    const o=parseArgs(args,['--metadata','--confirm']);
    if(o['--confirm']!==`UPLOAD_PRIVATE:${episode.episodeId}`)throw new Error('Explicit private-upload confirmation required before OAuth');
    if(!o['--metadata'])throw new Error('Upload requires an explicit --metadata JSON file');
    const metadata=validateVideoMetadata(JSON.parse(await readFile(resolve(ROOT,o['--metadata']),'utf8')) as unknown);
    const token=await acquireYouTubeAccessToken(credentialsFromEnvironment());
    const result=await uploadPrivateVideo({episode,metadata,accessToken:token,confirm:o['--confirm']});
    console.log(`PRIVATE_UPLOADED ${result.videoId}; no public publication was requested.`);return;
  }
  if(command==='jobs'){
    const db=new ProductionJobStore(join(ROOT,'workspace','jobs.sqlite'));
    try {console.log(JSON.stringify(db.list(episode.episodeId),null,2));}finally{db.close();}
    return;
  }
  if(command==='render'){
    if (args.length!==2 || args[0]!=='--preset' || !['preview','final'].includes(args[1]??'')) throw new Error('Render requires --preset preview|final');
    return render(episode,args[1] as keyof typeof presets);
  }
  if(command==='dub'){
    const o=parseArgs(args,['--locale','--translation']);
    if(o['--locale']!=='es-ES'&&o['--locale']!=='en-US')throw new Error('dub needs --locale es-ES|en-US');
    const m=await dubEpisode(episode,await localizationFile(episode,o['--locale'],o['--translation']),o['--locale']);
    console.log(`PASS ${m.episodeId} ${m.locale}: ${m.clips.length} speech clips; provider=${m.provider}`); return;
  }
  if(command==='mux'){
    const o=parseArgs(args,['--locale','--preset']);
    if(o['--locale']!=='es-ES'&&o['--locale']!=='en-US')throw new Error('mux needs --locale es-ES|en-US');
    if(o['--preset']!=='preview'&&o['--preset']!=='final')throw new Error('mux needs --preset preview|final');
    console.log('PASS '+await muxDubbedVideo(episode,o['--locale'],o['--preset']));return;
  }
  if(command==='package'){
    const o=parseArgs(args,['--preset']);
    if(o['--preset']!=='preview'&&o['--preset']!=='final')throw new Error('package needs --preset preview|final');
    const m=await packageEpisode(episode,o['--preset'],['es-ES','en-US']);
    console.log(`TECHNICAL_PASS ${m.episodeId}: ${Object.keys(m.artifacts).length} artifacts. EDITORIAL_PENDING; no publication permitted.`);return;
  }
  if(command==='pipeline'){
    const o=parseArgs(args,['--preset','--translation-en','--sound-design']);
    if(o['--preset']!=='preview'&&o['--preset']!=='final')throw new Error('pipeline needs --preset preview|final');
    if(!o['--translation-en'])throw new Error('pipeline requires --translation-en path');
    if(process.env.ANYMOTION_TEST_VOICE!=='synthetic'&&!configuredHttpTts())await runTool('espeak',['--version'],5000).catch(()=>{throw new Error('eSpeak diagnostic TTS not available on PATH; install eSpeak before pipeline:preview');});
    const english=await localizationFile(episode,'en-US',o['--translation-en']);
    const source=sourceLocalization(episode);
    if(o['--sound-design']){
      const design=JSON.parse(await readFile(resolve(ROOT,o['--sound-design']),'utf8')) as unknown;
      await createSoundscape(episode,design);
    }
    const db=new ProductionJobStore(join(ROOT,'workspace','jobs.sqlite'));
    const inputHash=createHash('sha256').update(JSON.stringify(episode)).digest('hex');
    try {
      // Measure the original-language voice and freeze the canonical timeline BEFORE rendering any picture.
      const esHash=createHash('sha256').update(inputHash+JSON.stringify(source)).digest('hex');
      const esSpec:JobSpec={episodeId:episode.episodeId,stage:'DUB',locale:'es-ES',inputHash:esHash};
      const spanish=await executeStage(db,esSpec,()=>dubEpisode(episode,source,'es-ES'),async m=>createHash('sha256').update(JSON.stringify(m)).digest('hex'));
      await freezeTimeline(episode,spanish);
      const chosenPreset=o['--preset'] as 'preview'|'final';
      const master=join(outputFolder(episode,chosenPreset),'silent.mp4');
      const spec:JobSpec={episodeId:episode.episodeId,stage:'RENDER',inputHash:createHash('sha256').update(inputHash+chosenPreset).digest('hex')};
      await executeStage(db,spec,async()=>{
        const existing=await stat(master).then(()=>true,(err:NodeJS.ErrnoException)=>{if(err.code==='ENOENT')return false;throw err;});
        if(!existing)await render(episode,chosenPreset);
        return verifyMaster(episode,chosenPreset);
      },sha256);
      for(const [locale,localized] of [['es-ES',source],['en-US',english]] as const){
        const dubHash=createHash('sha256').update(inputHash+JSON.stringify(localized)).digest('hex');
        if(locale==='en-US'){
          const dubSpec:JobSpec={episodeId:episode.episodeId,stage:'DUB',locale,inputHash:dubHash};
          await executeStage(db,dubSpec,()=>dubEpisode(episode,localized,locale),async m=>createHash('sha256').update(JSON.stringify(m)).digest('hex'));
        }
        const muxSpec:JobSpec={episodeId:episode.episodeId,stage:'MUX',locale,inputHash:dubHash};
        await executeStage(db,muxSpec,()=>muxDubbedVideo(episode,locale,o['--preset'] as 'preview'|'final'),sha256);
      }
      const release=await packageEpisode(episode,o['--preset'],['es-ES','en-US']);
      console.log(`TECHNICAL_PASS ${release.episodeId}: bilingual audiovisual package complete; EDITORIAL_PENDING.`);
    }finally{db.close();}
    return;
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
