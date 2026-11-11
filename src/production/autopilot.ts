/** Human-triggered draft automation: two bounded LLM calls, resume checkpoints, never publish. */
import {open,readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {withinRoot} from '../core/filenames.js';
import {validateGeneratedEpisode,validateStoryBrief,createStory,type StoryBrief,type StructuredStoryProvider} from '../story/llm.js';
import {createLocalizationDraft} from '../story/localizer.js';
import {validateLocalization} from '../audio/dubbing.js';
import type {Episode} from '../core/contracts.js';

const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const exists=(path:string)=>stat(path).then(()=>true,(e:NodeJS.ErrnoException)=>e.code==='ENOENT'?false:Promise.reject(e));
interface DraftRequest {schemaVersion:'1.0';episodeId:string;briefHash:string;modelId:string}
interface DraftReceipt {schemaVersion:'1.0';status:'DRAFTS_READY_EDITORIAL_PENDING';episodeId:string;briefHash:string;episodeHash:string;localizationHash:string;modelId:string;warnings:string[];completedAt:string}
export interface PreparedDrafts {episodePath:string;localizationPath:string;receipt:DraftReceipt;llmCallsThisRun:number}

function parseJson(value:string):unknown{return JSON.parse(value) as unknown;}

/** Neither completed drafts nor media files are overwritten. No secret value is persisted. */
export async function prepareEpisodeDrafts(input:unknown,provider:StructuredStoryProvider,root=resolve(process.cwd())):Promise<PreparedDrafts>{
 const brief=validateStoryBrief(input);
 const folder=withinRoot(resolve(root),join('workspace','drafts',brief.episodeId));
 await mkdir(folder,{recursive:true});
 const lockFile=join(folder,'.generation.lock');
 const lock=await open(lockFile,'wx').catch(()=>{throw new Error(`Draft generation already running for ${brief.episodeId}`);});
 let llmCallsThisRun=0;
 try{
  const briefHash=digest(JSON.stringify(brief));
  const requestFile=join(folder,'request.json');
  const episodePath=join(folder,'episode.json');
  const localizationPath=join(folder,'en-US.json');
  const receiptFile=join(folder,'drafts-ready.json');
  const expected:DraftRequest={schemaVersion:'1.0',episodeId:brief.episodeId,briefHash,modelId:provider.modelId};
  if(await exists(requestFile)){
   const previous=parseJson(await readFile(requestFile,'utf8')) as DraftRequest;
   if(JSON.stringify(previous)!==JSON.stringify(expected))throw new Error('Existing draft request belongs to another brief or model revision');
  }else{
   if(await exists(episodePath)||await exists(localizationPath)||await exists(receiptFile))throw new Error('Draft files exist without their request manifest');
   await writeFile(requestFile,JSON.stringify(expected,null,2)+'\n',{flag:'wx'});
  }
  let episode:Episode;
  let warnings:string[]=[];
  if(await exists(episodePath)){
   episode=validateGeneratedEpisode(parseJson(await readFile(episodePath,'utf8')),brief);
  }else{
   llmCallsThisRun++;
   const draft=await createStory(brief,provider);
   episode=draft.episode;warnings=draft.warnings;
   await writeFile(episodePath,JSON.stringify(episode,null,2)+'\n',{flag:'wx'});
  }
  if(await exists(localizationPath)){
   validateLocalization(parseJson(await readFile(localizationPath,'utf8')),episode,'en-US');
  }else{
   llmCallsThisRun++;
   const localized=await createLocalizationDraft(episode,'en-US',provider);
   await writeFile(localizationPath,JSON.stringify(localized,null,2)+'\n',{flag:'wx'});
  }
  const episodeHash=digest(await readFile(episodePath,'utf8'));
  const localizationHash=digest(await readFile(localizationPath,'utf8'));
  let receipt:DraftReceipt;
  if(await exists(receiptFile)){
   receipt=parseJson(await readFile(receiptFile,'utf8')) as DraftReceipt;
   if(receipt.status!=='DRAFTS_READY_EDITORIAL_PENDING'||receipt.episodeId!==brief.episodeId||receipt.briefHash!==briefHash||
     receipt.modelId!==provider.modelId||receipt.episodeHash!==episodeHash||receipt.localizationHash!==localizationHash)
     throw new Error('Draft checkpoint files changed after generation');
  }else{
   receipt={schemaVersion:'1.0',status:'DRAFTS_READY_EDITORIAL_PENDING',episodeId:brief.episodeId,briefHash,episodeHash,localizationHash,
    modelId:provider.modelId,warnings,completedAt:new Date().toISOString()};
   await writeFile(receiptFile,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  }
  return {episodePath,localizationPath,receipt,llmCallsThisRun};
 }finally{await lock.close();await rm(lockFile,{force:true});}
}
