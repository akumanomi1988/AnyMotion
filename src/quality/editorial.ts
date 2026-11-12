/** Explainable editorial risk evidence. An algorithm NEVER claims a story is funny/original. */
import {allDialogue,type Episode,validateEpisode} from '../core/contracts.js';
export interface EditorialFinding {
 id:string;severity:'warning'|'review';sceneId?:string;message:string;
}
export interface EditorialAnalysis {
 schemaVersion:'1.0';episodeId:string;durationMs:number;scenes:number;dialogueLines:number;
 characters:string[];cameraChanges:number;findings:EditorialFinding[];
 status:'HUMAN_REVIEW_REQUIRED';
}
const tokens=(s:string):string[]=>s.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(s=>s.length>3);
/** Risk alerts are explicit and always subordinate to a human's editorial judgment. */
export function analyzeEditorial(input:Episode,priorSummaries:readonly string[]=[]):EditorialAnalysis{
 const episode=validateEpisode(input);
 if(priorSummaries.length>100||priorSummaries.some(s=>typeof s!=='string'||s.length>600))throw new Error('Invalid prior episode summaries');
 const lines=allDialogue(episode);
 const findings:EditorialFinding[]=[];
 const add=(id:string,severity:EditorialFinding['severity'],message:string,sceneId?:string)=>findings.push({id,severity,message,...(sceneId?{sceneId}:{})});
 if(episode.durationMs<480000||episode.durationMs>600000)add('DURATION','warning','Outside the planned 8–10 minute commercial episode format');
 if(episode.scenes.length<4)add('SCENE_VARIETY','review','Few scenes; verify that the story escalates rather than repeating one gag');
 if(lines.length<35)add('DIALOGUE_DENSITY','review','Few dialogue turns for a long-form two-character sitcom');
 const spoken=new Map<string,number>();
 const uniqueLines=new Map<string,number>();
 for(const line of lines){
  spoken.set(line.characterId,(spoken.get(line.characterId)??0)+1);
  const text=tokens(line.text).join(' ');
  if(text.length>14)uniqueLines.set(text,(uniqueLines.get(text)??0)+1);
 }
 for(const [line,occurrences] of uniqueLines){
  if(occurrences>=3)add('DIALOGUE_REPETITION','review',`Repeated dialogue (${occurrences} times): ${line.slice(0,65)}`);
 }
 for(const scene of episode.scenes){
  if(scene.endMs-scene.startMs>120000)add('SCENE_LENGTH','review','Scene exceeds two minutes; inspect progression',scene.sceneId);
  const shots=scene.camera;
  for(let i=0;i<shots.length;i++){
   const held=(shots[i+1]?.atMs??scene.endMs)-shots[i]!.atMs;
   if(held>30000)add('STATIC_CAMERA','review',`Camera hold ${Math.round(held/1000)}s; confirm acting changes justify it`,scene.sceneId);
  }
  if(scene.dialogue.length>=5&&scene.actions.length===0)add('STATIC_ACTING','review','Many dialogue turns with no declared character actions',scene.sceneId);
  const longestSilence=scene.dialogue.length>0?
   Math.max(scene.dialogue[0]!.startMs-scene.startMs,...scene.dialogue.slice(1).map((l,i)=>Math.max(0,l.startMs-scene.dialogue[i]!.endMs)),scene.endMs-scene.dialogue.at(-1)!.endMs):scene.endMs-scene.startMs;
  if(longestSilence>25000)add('SILENT_GAP','review',`Undirected silence of ${Math.round(longestSilence/1000)}s; justify with visual action`,scene.sceneId);
 }
 const lCount=lines.length;
 for(const actor of ['vera','leo'])if((spoken.get(actor)??0)<lCount*.15)add('SPEAKER_BALANCE','review',`${actor} has fewer than 15% of all lines; intentional?`);
 const textTokens=new Set(tokens(lines.map(l=>l.text).join(' ')));
 for(const summary of priorSummaries){
  const prior=new Set(tokens(summary));
  if(prior.size<7)continue;
  const overlap=[...prior].filter(t=>textTokens.has(t)).length/prior.size;
  if(overlap>.65)add('SIMILARITY_WARNING','review',`Potentially similar prior premise (${Math.round(overlap*100)}% vocabulary overlap): ${summary.slice(0,90)}`);
 }
 add('HUMAN_EDITORIAL_QA','warning','A human must review humor, originality, voice, rights and cultural adaptation before release');
 return {schemaVersion:'1.0',episodeId:episode.episodeId,durationMs:episode.durationMs,scenes:episode.scenes.length,dialogueLines:lines.length,
  characters:[...new Set(lines.map(l=>l.characterId))].sort(),cameraChanges:episode.scenes.reduce((sum,s)=>sum+s.camera.length-1,0),findings,status:'HUMAN_REVIEW_REQUIRED'};
}
