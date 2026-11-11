/** Original procedural sound design. No third-party sound files or music samples. */
import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {validateEpisode,type Episode} from '../core/contracts.js';
import {withinRoot} from '../core/filenames.js';

const SAMPLE_RATE=24000;
const VERSION='1.0';
const EFFECTS=['tap','pop','chime','swish'] as const;
export type SoundEffect=typeof EFFECTS[number];
export interface SoundCue {id:string;effect:SoundEffect;atMs:number;gain:number}
export interface SoundDesign {schemaVersion:'1.0';episodeId:string;cues:SoundCue[];music:{introMs:number;outroMs:number;gain:number}}
export interface SoundscapeManifest {schemaVersion:'1.0';status:'SOUNDSCAPE_READY';episodeId:string;episodeHash:string;designHash:string;engineVersion:string;origin:'original-procedural';sampleRate:number;durationMs:number;files:{'music.wav':string;'sfx.wav':string;'sound-design.json':string}}
const hash=(input:Buffer|string)=>createHash('sha256').update(input).digest('hex');
const exists=(path:string)=>stat(path).then(()=>true,(e:NodeJS.ErrnoException)=>e.code==='ENOENT'?false:Promise.reject(e));
const obj=(o:unknown):o is Record<string,unknown>=>!!o&&typeof o==='object'&&!Array.isArray(o);
const keys=(o:Record<string,unknown>,names:string[])=>Object.keys(o).sort().join(',')===names.sort().join(',');

export function validateSoundDesign(input:unknown,episode:Episode):SoundDesign{
 if(!obj(input)||!keys(input,['schemaVersion','episodeId','cues','music'])||input.schemaVersion!==VERSION||input.episodeId!==episode.episodeId)
  throw new Error('Sound design schema or episode identity mismatch');
 if(!Array.isArray(input.cues)||input.cues.length>120)throw new Error('Sound cues must be an array with <=120 entries');
 const ids=new Set<string>();
 for(const [index,raw] of input.cues.entries()){
  if(!obj(raw)||!keys(raw,['id','effect','atMs','gain'])||typeof raw.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(raw.id)||ids.has(raw.id)||
   !EFFECTS.includes(raw.effect as SoundEffect)||!Number.isSafeInteger(raw.atMs)||Number(raw.atMs)<0||Number(raw.atMs)>=episode.durationMs||
   typeof raw.gain!=='number'||!Number.isFinite(raw.gain)||raw.gain<0||raw.gain>0.25)
    throw new Error(`Invalid sound cue at index ${index}`);
  ids.add(raw.id);
 }
 if(!obj(input.music)||!keys(input.music,['introMs','outroMs','gain'])||
  !Number.isSafeInteger(input.music.introMs)||!Number.isSafeInteger(input.music.outroMs)||
  Number(input.music.introMs)<0||Number(input.music.outroMs)<0||
  Number(input.music.introMs)>12000||Number(input.music.outroMs)>12000||
  Number(input.music.introMs)+Number(input.music.outroMs)>episode.durationMs||
  typeof input.music.gain!=='number'||!Number.isFinite(input.music.gain)||input.music.gain<0||input.music.gain>0.16)
  throw new Error('Invalid original music timing or gain');
 return input as unknown as SoundDesign;
}

function createWav(pcm:Buffer):Buffer{
 const header=Buffer.alloc(44);
 header.write('RIFF',0);header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);
 header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
 header.writeUInt32LE(SAMPLE_RATE,24);header.writeUInt32LE(SAMPLE_RATE*2,28);
 header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);
 header.write('data',36);header.writeUInt32LE(pcm.length,40);
 return Buffer.concat([header,pcm]);
}
export function assertWav(wav:Buffer,expectedMs:number):void{
 const frames=Math.ceil(expectedMs*SAMPLE_RATE/1000);
 if(wav.length!==44+frames*2||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE'||
  wav.readUInt16LE(20)!==1||wav.readUInt16LE(22)!==1||wav.readUInt32LE(24)!==SAMPLE_RATE||
  wav.readUInt16LE(34)!==16||wav.toString('ascii',36,40)!=='data'||wav.readUInt32LE(40)!==frames*2)
  throw new Error('Invalid 24kHz 16-bit mono WAV soundtrack');
}
function addSample(buffer:Buffer,index:number,value:number):void{
 if(index<0||index*2+1>=buffer.length)return;
 const current=buffer.readInt16LE(index*2);
 const next=current+Math.round(value);
 if(Math.abs(next)>32000)throw new Error('Sound effect internal clipping; reduce gains');
 buffer.writeInt16LE(next,index*2);
}
function renderEffect(pcm:Buffer,cue:SoundCue):void{
 const start=Math.round(cue.atMs*SAMPLE_RATE/1000);
 const seconds={tap:.085,pop:.18,chime:.56,swish:.34}[cue.effect];
 const count=Math.min(Math.round(seconds*SAMPLE_RATE),pcm.length/2-start);
 const seed=[...cue.id].reduce((a,ch)=>(Math.imul(a,33)+ch.charCodeAt(0))|0,2371);
 for(let i=0;i<count;i++){
  const t=i/SAMPLE_RATE;
  const decay=Math.pow(Math.max(0,1-i/count),cue.effect==='chime'?2.1:3.5);
  const envelope=Math.min(1,i/120)*decay;
  // Bounded deterministic pseudo-noise, no Math.random or external dependencies.
  const noise=Math.sin((i+1)*(seed%113+53)*.179+Math.sin(i*.17)*3.7);
  const wave=cue.effect==='tap'?Math.sin(2*Math.PI*165*t)*.7+noise*.25:
   cue.effect==='pop'?Math.sin(2*Math.PI*(300-180*t)*t):
   cue.effect==='chime'?Math.sin(2*Math.PI*660*t)*.65+Math.sin(2*Math.PI*990*t)*.25:
   noise*.5+Math.sin(2*Math.PI*(700-500*t)*t)*.35;
  addSample(pcm,start+i,wave*cue.gain*9000*envelope);
 }
}
function renderMotif(pcm:Buffer,startMs:number,durationMs:number,gain:number):void{
 if(!durationMs||!gain)return;
 const start=Math.round(startMs*SAMPLE_RATE/1000);
 const total=Math.round(durationMs*SAMPLE_RATE/1000);
 // Short original four-note motif, procedurally synthesized and authored for AnyMotion.
 const tones=[220,277.18,329.63,293.66];
 for(let i=0;i<total;i++){
  const time=i/SAMPLE_RATE;
  const chord=Math.min(3,Math.floor(i/Math.max(1,total/4)));
  const local=i/Math.max(1,total/4)-chord;
  const attack=Math.min(1,local*15),release=Math.min(1,(1-local)*7);
  const envelope=Math.max(0,attack*release)*Math.min(1,i/900,(total-i-1)/1200);
  const note=tones[chord]??220;
  const wave=Math.sin(2*Math.PI*note*time)*.72+Math.sin(2*Math.PI*(note/2)*time)*.2;
  addSample(pcm,start+i,wave*gain*10000*envelope);
 }
}

export async function verifySoundscape(episode:Episode,root=resolve(process.cwd())):Promise<{manifest:SoundscapeManifest;manifestHash:string;music:Buffer;sfx:Buffer}|null>{
 const ep=validateEpisode(episode),folder=withinRoot(root,join('productions',ep.episodeId,'audio'));
 const manifestFile=join(folder,'sound-manifest.json');
 if(!await exists(manifestFile)){
  if(await exists(join(folder,'music.wav'))||await exists(join(folder,'sfx.wav')))throw new Error('Unmanaged soundtrack files detected');
  return null;
 }
 const content=await readFile(manifestFile);
 const manifest=JSON.parse(content.toString('utf8')) as SoundscapeManifest;
 if(manifest.schemaVersion!==VERSION||manifest.status!=='SOUNDSCAPE_READY'||manifest.episodeId!==ep.episodeId||
  manifest.episodeHash!==hash(JSON.stringify(ep))||manifest.engineVersion!==VERSION||manifest.origin!=='original-procedural'||
  manifest.sampleRate!==SAMPLE_RATE||manifest.durationMs!==ep.durationMs||!manifest.files||
  Object.keys(manifest.files).sort().join(',')!=='music.wav,sfx.wav,sound-design.json')throw new Error('Sound manifest is stale or invalid');
 const music=await readFile(join(folder,'music.wav')),sfx=await readFile(join(folder,'sfx.wav'));
 const designText=await readFile(join(folder,'sound-design.json'),'utf8');
 const design=validateSoundDesign(JSON.parse(designText) as unknown,ep);
 if(hash(JSON.stringify(design))!==manifest.designHash||hash(designText)!==manifest.files['sound-design.json'])
  throw new Error('Original sound design provenance changed');
 assertWav(music,ep.durationMs);assertWav(sfx,ep.durationMs);
 if(hash(music)!==manifest.files['music.wav']||hash(sfx)!==manifest.files['sfx.wav'])throw new Error('Soundtrack asset hash mismatch');
 return {manifest,manifestHash:hash(content),music,sfx};
}

export async function createSoundscape(episode:Episode,design:unknown,root=resolve(process.cwd())):Promise<SoundscapeManifest>{
 const ep=validateEpisode(episode),validated=validateSoundDesign(design,ep);
 const episodeHash=hash(JSON.stringify(ep)),designHash=hash(JSON.stringify(validated));
 const previous=await verifySoundscape(ep,root);
 if(previous){if(previous.manifest.designHash!==designHash)throw new Error('Sound design changed; create new episode revision');return previous.manifest;}
 const base=withinRoot(root,join('productions',ep.episodeId));
 const folder=withinRoot(base,'audio');
 const temp=withinRoot(root,join('workspace','temp',`audio-${ep.episodeId}-${process.pid}-${Date.now()}`));
 if(await exists(folder))throw new Error('Audio output directory already exists without manifest');
 await mkdir(temp,{recursive:true});
 try{
  const count=Math.ceil(ep.durationMs*SAMPLE_RATE/1000);
  const music=Buffer.alloc(count*2),sfx=Buffer.alloc(count*2);
  for(const cue of validated.cues)renderEffect(sfx,cue);
  renderMotif(music,0,validated.music.introMs,validated.music.gain);
  renderMotif(music,ep.durationMs-validated.music.outroMs,validated.music.outroMs,validated.music.gain);
  const musicWav=createWav(music),sfxWav=createWav(sfx);
  const designText=JSON.stringify(validated,null,2)+'\n';
  await writeFile(join(temp,'sound-design.json'),designText);
  await writeFile(join(temp,'music.wav'),musicWav);
  await writeFile(join(temp,'sfx.wav'),sfxWav);
  const manifest:SoundscapeManifest={schemaVersion:VERSION,status:'SOUNDSCAPE_READY',episodeId:ep.episodeId,
   episodeHash,designHash,engineVersion:VERSION,origin:'original-procedural',sampleRate:SAMPLE_RATE,durationMs:ep.durationMs,
   files:{'music.wav':hash(musicWav),'sfx.wav':hash(sfxWav),'sound-design.json':hash(designText)}};
  await writeFile(join(temp,'sound-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  await mkdir(base,{recursive:true});
  await rename(temp,folder);
  await verifySoundscape(ep,root);
  return manifest;
 }finally{await rm(temp,{recursive:true,force:true});}
}

/** One shared soundtrack is mixed separately with every localized dialogue track. */
export function mixSoundtrack(dialogueWav:Buffer,musicWav:Buffer,sfxWav:Buffer,episodeMs:number):Buffer{
 assertWav(dialogueWav,episodeMs);assertWav(musicWav,episodeMs);assertWav(sfxWav,episodeMs);
 const result=Buffer.from(dialogueWav);
 for(let offset=44;offset<result.length;offset+=2){
  const sum=dialogueWav.readInt16LE(offset)+musicWav.readInt16LE(offset)+sfxWav.readInt16LE(offset);
  if(sum>32767||sum < -32768)throw new Error('Full audio clipping; lower sound design gain');
  result.writeInt16LE(sum,offset);
 }
 return result;
}
