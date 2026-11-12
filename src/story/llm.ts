/** Optional LLM story adapter. All model output is untrusted and must pass Episode contracts. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateEpisode, type Episode } from '../core/contracts.js';

export interface StoryBrief { schemaVersion:'1.0'; episodeId:string; premise:string; targetMinutes:number; priorSummaries:string[] }
export interface StoryResult { episode:Episode; warnings:string[]; model:string }
export interface StructuredStoryProvider { readonly modelId:string; generateJson(system:string,user:string,maxOutputTokens:number):Promise<unknown> }

const SYSTEM_PROMPT = `You are writing a completely original 2D animated adult sitcom about a couple. Output strictly ONE JSON object matching the supplied Episode v1 schema, no Markdown, no executable code and no extra fields. Two leads: Vera is intelligent, organized, sometimes excessively controlling; Leo is imaginative, confident, often overcomplicates simple problems. They are affectionate peers, neither must always win. One independent story with cause, escalating complications, payoff and distinctive visual comedy. Avoid plagiarism, real-world identities, gender stereotypes and filler. The available setIds are only living-room, kitchen, bedroom. Valid shot ids: wide,twoShot,mediumVera,mediumLeo,closeVera,closeLeo. Valid actions are setExpression with expression neutral,happy,skeptical,surprised,annoyed,thinking; gesture with gesture raiseHand,point,crossArms,shrug,idle and durationMs; lookAt with targetId vera,leo,audience. Use integer absolute millisecond timestamps. Each scene's camera starts at scene.startMs, scenes exactly partition [0,durationMs], each dialogue line belongs to its scene and has stable unique lineId. canvas width=1280 height=720, fps=30, sourceLocale=es-ES, schemaVersion=1.0. Title and all dialogue in natural European Spanish. Distinct camera choices, reactions, visual action, pauses for humor. Do NOT add narration or subtitle text to the video.`;

export function validateStoryBrief(input:unknown):StoryBrief {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Story brief must be an object');
  const v=input as Record<string,unknown>;
  if(Object.keys(v).sort().join(',')!=='episodeId,premise,priorSummaries,schemaVersion,targetMinutes')throw new Error('Story brief fields invalid');
  if(v.schemaVersion!=='1.0'||typeof v.episodeId!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(v.episodeId))throw new Error('Invalid story identity');
  if(typeof v.premise!=='string'||v.premise.trim().length<12||v.premise.length>800)throw new Error('Premise must contain 12–800 characters');
  if(typeof v.targetMinutes!=='number'||v.targetMinutes<8||v.targetMinutes>10)throw new Error('Target duration outside 8–10min');
  if(!Array.isArray(v.priorSummaries)||v.priorSummaries.length>30||v.priorSummaries.some(s=>typeof s!=='string'||s.length>400))throw new Error('Invalid anti-repetition summaries');
  return input as StoryBrief;
}

export function validateGeneratedEpisode(input:unknown,brief:StoryBrief):Episode {
  const episode=validateEpisode(input);
  if(episode.episodeId!==brief.episodeId)throw new Error('LLM changed the episode ID');
  if(episode.durationMs<480000||episode.durationMs>600000)throw new Error('LLM episode duration is not 8–10min');
  if(Math.abs(episode.durationMs/60000-brief.targetMinutes)>1)throw new Error('Episode differs excessively from requested length');
  if(episode.scenes.length<3)throw new Error('Episode requires multiple scenes');
  const lines=episode.scenes.flatMap(s=>s.dialogue);
  if(lines.length<35)throw new Error('Episode has too few dialogue turns');
  const speakers=new Set(lines.map(l=>l.characterId));
  if(speakers.size<2)throw new Error('Episode needs both protagonists');
  const distinctShots=new Set(episode.scenes.flatMap(s=>s.camera.map(c=>c.shot)));
  if(distinctShots.size<3)throw new Error('Insufficient camera variation');
  return episode;
}

export function storyWarnings(episode:Episode,brief:StoryBrief):string[] {
  const warnings:string[]=[];
  const lines=episode.scenes.flatMap(s=>s.dialogue);
  const normalized=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>3);
  const body=normalized(lines.map(l=>l.text).join(' '));
  const unique=new Set(body);
  if(unique.size<80)warnings.push('Low lexical diversity: editorial review recommended');
  if(episode.scenes.some(s=>s.endMs-s.startMs>90000))warnings.push('Long static scene risk: review visual rhythm');
  for(const prior of brief.priorSummaries){
    const tokens=new Set(normalized(prior));
    const intersection=[...tokens].filter(x=>unique.has(x)).length;
    const overlap=intersection/Math.max(1,Math.min(tokens.size,unique.size));
    if(overlap>.67)warnings.push(`Possible repeated premise versus prior episode: ${prior.slice(0,50)}`);
  }
  return warnings;
}

export async function createStory(briefInput:unknown, provider:StructuredStoryProvider):Promise<StoryResult>{
  const brief=validateStoryBrief(briefInput);
  const requirements={schemaVersion:'1.0',episodeId:brief.episodeId,title:'',sourceLocale:'es-ES',canvas:{width:1280,height:720},fps:30,durationMs:brief.targetMinutes*60000,scenes:[{sceneId:'SC001',setId:'living-room',startMs:0,endMs:60000,camera:[{atMs:0,shot:'wide'}],actions:[{id:'AC001',type:'setExpression',actorId:'vera',atMs:0,expression:'skeptical'}],dialogue:[{lineId:'DL001',characterId:'leo',startMs:1000,endMs:3500,text:'...' }]}]};
  const user=JSON.stringify({premise:brief.premise,targetMinutes:brief.targetMinutes,episodeId:brief.episodeId,usedPremises:brief.priorSummaries,expectedShapeExample:requirements});
  const raw=await provider.generateJson(SYSTEM_PROMPT,user,16000);
  const ep=validateGeneratedEpisode(raw,brief);
  return {episode:ep,warnings:storyWarnings(ep,brief),model:provider.modelId};
}

export class OpenAICompatibleStoryProvider implements StructuredStoryProvider {
  readonly modelId:string;
  private endpoint:string;
  private apiKey:string;
  constructor(config:{endpoint:string;apiKey:string;model:string}) {
    const u=new URL(config.endpoint);
    if(u.protocol!=='https:' && !(u.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(u.hostname)))throw new Error('Remote LLM endpoint must use HTTPS');
    if(!config.apiKey.trim()||!config.model.trim())throw new Error('LLM provider requires an explicit API key and model');
    this.endpoint=u.toString();this.apiKey=config.apiKey;this.modelId=config.model;
  }
  async generateJson(system:string,user:string,maxOutputTokens:number):Promise<unknown>{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),180000);
    try{
      const response=await fetch(this.endpoint,{method:'POST',headers:{'Authorization':`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.modelId,messages:[{role:'system',content:system},{role:'user',content:user}],response_format:{type:'json_object'},max_completion_tokens:maxOutputTokens}),signal:controller.signal});
      if(!response.ok)throw new Error(`LLM provider returned HTTP ${response.status}`);
      const body=await response.json() as {choices?:Array<{message?:{content?:string}}>};
      const content=body.choices?.[0]?.message?.content;
      if(typeof content!=='string'||content.length>2_000_000)throw new Error('LLM returned empty or oversized content');
      return JSON.parse(content) as unknown;
    }finally{clearTimeout(timer);}
  }
}

export async function generateDraftFile(briefPath:string,outputPath:string):Promise<StoryResult>{
  const model=process.env.ANYMOTION_LLM_MODEL;
  const key=process.env.ANYMOTION_LLM_API_KEY;
  const endpoint=process.env.ANYMOTION_LLM_ENDPOINT;
  if(!model||!key||!endpoint)throw new Error('Missing ANYMOTION_LLM_MODEL, ANYMOTION_LLM_API_KEY or ANYMOTION_LLM_ENDPOINT; no API call was made');
  const provider=new OpenAICompatibleStoryProvider({model,apiKey:key,endpoint});
  const brief=JSON.parse(await readFile(resolve(briefPath),'utf8')) as unknown;
  const result=await createStory(brief,provider);
  // Never overwrite an approved or existing episode; generated scripts are drafts.
  await writeFile(resolve(outputPath),JSON.stringify(result.episode,null,2)+'\n',{flag:'wx'});
  return result;
}
