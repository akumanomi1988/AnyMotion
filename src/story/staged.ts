/** Bounded outline -> scene LLM pipeline. No model-generated executable code is ever accepted. */
import {validateEpisode,type Episode,type EpisodeScene} from '../core/contracts.js';
import {validateGeneratedEpisode,storyWarnings,type StoryBrief,type StructuredStoryProvider,validateStoryBrief} from './llm.js';

export interface Beat {
 sceneId:string;setId:'living-room'|'kitchen'|'bedroom';startMs:number;endMs:number;
 purpose:string;conflictStep:string;
}
export interface Outline {schemaVersion:'1.0';episodeId:string;title:string;beats:Beat[]}
export interface StagedResult {episode:Episode;outline:Outline;warnings:string[];model:string;llmCalls:number}
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const strict=(obj:Record<string,unknown>,fields:string[])=>Object.keys(obj).sort().join('|')===fields.sort().join('|');
export function validateOutline(input:unknown,brief:StoryBrief):Outline{
 if(!object(input)||!strict(input,['schemaVersion','episodeId','title','beats']))throw new Error('Invalid outline fields');
 if(input.schemaVersion!=='1.0'||input.episodeId!==brief.episodeId||typeof input.title!=='string'||input.title.trim().length<8||input.title.length>120)throw new Error('Outline identity or title mismatch');
 if(!Array.isArray(input.beats)||input.beats.length<5||input.beats.length>12)throw new Error('Outline needs 5–12 dramatic scenes');
 const ids=new Set<string>();let cursor=0;
 for(const [index,item] of input.beats.entries()){
  if(!object(item)||!strict(item,['sceneId','setId','startMs','endMs','purpose','conflictStep']))throw new Error(`Invalid outline beat ${index}`);
  if(typeof item.sceneId!=='string'||!/^SC[0-9]{3,5}$/.test(item.sceneId)||ids.has(item.sceneId))throw new Error(`Duplicate or invalid beat id ${index}`);
  ids.add(item.sceneId);
  if(!['living-room','kitchen','bedroom'].includes(String(item.setId)))throw new Error('Unknown set in outline');
  if(!Number.isSafeInteger(item.startMs)||!Number.isSafeInteger(item.endMs)||item.startMs!==cursor||Number(item.endMs)<=cursor+5000)throw new Error('Outline must exactly partition the episode timeline');
  if(typeof item.purpose!=='string'||item.purpose.trim().length<15||typeof item.conflictStep!=='string'||item.conflictStep.trim().length<15)throw new Error('Beat needs a meaningful purpose and escalation');
  cursor=Number(item.endMs);
 }
 if(cursor!==Math.round(brief.targetMinutes*60000))throw new Error('Outline duration differs from story brief');
 return input as unknown as Outline;
}
/** Independently validate each generated scene via the existing strict Episode contract. */
export function validateBeatScene(value:unknown,beat:Beat,episodeId:string):EpisodeScene{
 if(!object(value)||value.sceneId!==beat.sceneId||value.setId!==beat.setId||value.startMs!==beat.startMs||value.endMs!==beat.endMs)throw new Error(`Scene does not follow outline beat ${beat.sceneId}`);
 const scene=value as unknown as EpisodeScene;
 if(!Array.isArray(scene.camera)||!Array.isArray(scene.actions)||!Array.isArray(scene.dialogue))throw new Error('Scene is missing camera/actions/dialogue');
 if(scene.dialogue.length<4)throw new Error(`Scene ${beat.sceneId} needs at least four meaningful dialogue lines`);
 const offset=beat.startMs;
 const moved={...scene,startMs:0,endMs:beat.endMs-offset,
  camera:scene.camera.map(c=>({...c,atMs:c.atMs-offset})),
  actions:scene.actions.map(a=>({...a,atMs:a.atMs-offset})),
  dialogue:scene.dialogue.map(d=>({...d,startMs:d.startMs-offset,endMs:d.endMs-offset}))};
 validateEpisode({schemaVersion:'1.0',episodeId,title:'Isolated staged scene',sourceLocale:'es-ES',fps:30,canvas:{width:1280,height:720},durationMs:beat.endMs-offset,scenes:[moved]});
 return scene;
}
/** A single invalid scene is retried once with precise contract feedback, never the whole story. */
export async function createStagedStory(briefInput:unknown,provider:StructuredStoryProvider):Promise<StagedResult>{
 const brief=validateStoryBrief(briefInput);
 let llmCalls=0;
 const outlinePrompt=`Create an original adult couple sitcom outline in Spanish. Output a JSON object ONLY: {schemaVersion:"1.0",episodeId,title,beats:[{sceneId:"SC001",setId:"living-room",startMs:0,endMs:90000,purpose:"...",conflictStep:"..."}]}. Use 5–12 beats, each with a 15+ character purpose and escalation. Use only registered setIds living-room,kitchen,bedroom. All times are absolute integer milliseconds and must exactly cover ${Math.round(brief.targetMinutes*60000)} ms without gaps. The story has a trigger, incompatible strategies, escalating consequences, genuine reversals and a payoff; Vera and Leo remain affectionate peers. No imitation of third-party shows. Keep jokes localizable.`;
 const outlineRaw=await provider.generateJson(outlinePrompt,JSON.stringify({premise:brief.premise,episodeId:brief.episodeId,targetMinutes:brief.targetMinutes,priorSummaries:brief.priorSummaries}),4800);
 llmCalls++;
 const outline=validateOutline(outlineRaw,brief);
 const scenes:EpisodeScene[]=[];
 for(const beat of outline.beats){
  let failure='';let accepted:EpisodeScene|undefined;
  for(let attempt=0;attempt<2;attempt++){
   const scenePrompt=`Write one ORIGINAL, production-ready Spanish sitcom scene as exactly one JSON EpisodeScene object (NOT an array or an Episode). Required fields: sceneId,setId,startMs,endMs,camera,actions,dialogue. Camera cues must start exactly at scene start. Valid shots: wide,twoShot,mediumVera,mediumLeo,closeVera,closeLeo. Valid actor ids: vera,leo. Valid actions: setExpression(expression:neutral,happy,skeptical,surprised,annoyed,thinking),gesture(gesture:raiseHand,point,crossArms,shrug,idle,durationMs),lookAt(targetId:vera,leo,audience). Every action has a globally unique id, e.g. AC001; every dialogue line has globally unique id, e.g. DL001. Use integer absolute ms and stay within the beat. Write at least six funny, natural, context-aware dialogue lines and visual reaction cues. No new set/prop/character/action types. No code, no commentary, no markdown. ${failure?`PREVIOUS CONTRACT ERROR TO REPAIR: ${failure}`:''}`;
   const raw=await provider.generateJson(scenePrompt,JSON.stringify({outline,beat,priorScenes:scenes.map(s=>({sceneId:s.sceneId,finalDialogue:s.dialogue.slice(-3).map(d=>d.text)})),episodeId:brief.episodeId}),4800);
   llmCalls++;
   try{
    const candidate=validateBeatScene(raw,beat,brief.episodeId);
    const priorIds=new Set(scenes.flatMap(s=>[...s.actions.map(a=>a.id),...s.dialogue.map(d=>d.lineId)]));
    if([...candidate.actions.map(a=>a.id),...candidate.dialogue.map(d=>d.lineId)].some(id=>priorIds.has(id)))
      throw new Error('Action or dialogue IDs collide with previously accepted scenes');
    accepted=candidate;break;
   }
   catch(e){failure=e instanceof Error?e.message:String(e);}
  }
  if(!accepted)throw new Error(`Failed to repair scene ${beat.sceneId}: ${failure}`);
  scenes.push(accepted);
 }
 const episode=validateGeneratedEpisode({schemaVersion:'1.0',episodeId:brief.episodeId,title:outline.title,sourceLocale:'es-ES',fps:30,canvas:{width:1280,height:720},durationMs:Math.round(brief.targetMinutes*60000),scenes},brief);
 return {episode,outline,warnings:storyWarnings(episode,brief),model:provider.modelId,llmCalls};
}
