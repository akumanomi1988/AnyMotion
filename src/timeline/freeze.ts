/** Source speech is measured before visual render, and this revision becomes immutable. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {type Episode,validateEpisode} from '../core/contracts.js';
import {withinRoot} from '../core/filenames.js';
import type {DubManifest} from '../audio/dubbing.js';

export interface FrozenTimeline {
  schemaVersion:'1.0'; status:'TIMELINE_FROZEN'; episodeId:string; sourceLocale:'es-ES';
  durationMs:number; timelineRevision:string; episodeHash:string; sourceVoiceHash:string;
  lineTimings:{lineId:string;startMs:number;endMs:number;measuredSpeechMs:number;tempo:number}[];
}
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');

export async function freezeTimeline(episodeInput:Episode,source:DubManifest,root=resolve(process.cwd())):Promise<FrozenTimeline>{
  const ep=validateEpisode(episodeInput);
  const episodeHash=sha(JSON.stringify(ep));
  if(source.episodeId!==ep.episodeId||source.locale!=='es-ES'||source.timelineSha256!==episodeHash||source.status!=='LOCALIZED')throw new Error('Source speech does not match current episode');
  const lines=ep.scenes.flatMap(s=>s.dialogue).sort((a,b)=>a.startMs-b.startMs);
  const reports=new Map(source.clips.map(c=>[c.lineId,c]));
  if(reports.size!==lines.length)throw new Error('Source speech report is missing lines');
  const lineTimings=lines.map(l=>{
    const speech=reports.get(l.lineId);
    if(!speech||speech.fittedDurationMs>l.endMs-l.startMs+1||speech.clipped)throw new Error(`Source voice fails timing for ${l.lineId}`);
    return {lineId:l.lineId,startMs:l.startMs,endMs:l.endMs,measuredSpeechMs:speech.sourceDurationMs,tempo:speech.tempo};
  });
  const sourceVoiceHash=sha(JSON.stringify(source));
  const timelineRevision=sha(`${episodeHash}:${sourceVoiceHash}`).slice(0,20);
  const frozen:FrozenTimeline={schemaVersion:'1.0',status:'TIMELINE_FROZEN',episodeId:ep.episodeId,sourceLocale:'es-ES',durationMs:ep.durationMs,timelineRevision,episodeHash,sourceVoiceHash,lineTimings};
  const dir=withinRoot(root,join('productions',ep.episodeId));
  await mkdir(dir,{recursive:true});
  const path=join(dir,'timeline.json');
  try{
    const old=JSON.parse(await readFile(path,'utf8')) as FrozenTimeline;
    if(JSON.stringify(old)!==JSON.stringify(frozen))throw new Error('Frozen timeline changed; create a new episode revision');
    return old;
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  await writeFile(path,JSON.stringify(frozen,null,2)+'\n',{flag:'wx'});
  return frozen;
}
