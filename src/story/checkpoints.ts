/** Content-addressed LLM call checkpoints: resume without rebilling completed stages. */
import {createHash} from 'node:crypto';
import {mkdir,open,readFile,writeFile,rm,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {withinRoot} from '../core/filenames.js';
import {validateStoryBrief,type StoryBrief,type StructuredStoryProvider} from './llm.js';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
interface RequestRecord {schemaVersion:'1.0';episodeId:string;modelId:string;briefHash:string}
interface CacheRecord {schemaVersion:'1.0';modelId:string;inputHash:string;outputHash:string;output:unknown}
export interface StagedProviderSession {provider:StructuredStoryProvider;close:()=>Promise<void>;calls:()=>number;usage:()=>Readonly<StagedBudgetUsage>}
export interface StagedBudgetUsage {schemaVersion:'1.0';episodeId:string;modelId:string;reservedCalls:number;requestedOutputTokens:number}
export interface StagedBudgetLimits {maxCalls:number;maxRequestedOutputTokens:number}
/** One active writer per episode, with strict request identity and digest-verified JSON. */
export async function startStagedProviderSession(briefInput:StoryBrief,underlying:StructuredStoryProvider,root=resolve(process.cwd()),limits:StagedBudgetLimits={maxCalls:30,maxRequestedOutputTokens:120000}):Promise<StagedProviderSession>{
 const brief=validateStoryBrief(briefInput);
 if(!Number.isSafeInteger(limits.maxCalls)||limits.maxCalls<1||limits.maxCalls>100||!Number.isSafeInteger(limits.maxRequestedOutputTokens)||limits.maxRequestedOutputTokens<100||limits.maxRequestedOutputTokens>1_000_000)throw new Error('Invalid LLM budget limits');
 const dir=withinRoot(resolve(root),join('workspace','drafts',brief.episodeId,'staged'));
 await mkdir(dir,{recursive:true});
 const lockFile=join(dir,'.active.lock');
 const lock=await open(lockFile,'wx').catch(()=>{throw new Error('Staged generation already active for this episode');});
 let calls=0,closed=false;
 try{
  const request:RequestRecord={schemaVersion:'1.0',episodeId:brief.episodeId,modelId:underlying.modelId,briefHash:hash(JSON.stringify(brief))};
  const requestPath=join(dir,'request.json');
  try{
   const previous=JSON.parse(await readFile(requestPath,'utf8')) as RequestRecord;
   if(JSON.stringify(previous)!==JSON.stringify(request))throw new Error('Staged generation request changed; create a new episode revision');
  }catch(e){
   if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;
   await writeFile(requestPath,JSON.stringify(request,null,2)+'\n',{flag:'wx'});
  }
  const budgetFile=join(dir,'budget-reservations.json');
  let usage:StagedBudgetUsage;
  try{
   const prior=JSON.parse(await readFile(budgetFile,'utf8')) as StagedBudgetUsage;
   if(prior.schemaVersion!=='1.0'||prior.episodeId!==brief.episodeId||prior.modelId!==underlying.modelId||
      !Number.isSafeInteger(prior.reservedCalls)||prior.reservedCalls<0||
      !Number.isSafeInteger(prior.requestedOutputTokens)||prior.requestedOutputTokens<0)
     throw new Error('LLM budget ledger corrupted or for a different model');
   usage=prior;
  }catch(e){
   if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;
   usage={schemaVersion:'1.0',episodeId:brief.episodeId,modelId:underlying.modelId,reservedCalls:0,requestedOutputTokens:0};
  }
  const provider:StructuredStoryProvider={modelId:underlying.modelId,generateJson:async(system,user,maxOutputTokens)=>{
   if(closed)throw new Error('Staged session already closed');
   if(!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>16000)throw new Error('Invalid per-call LLM output token bound');
   const inputHash=hash(JSON.stringify({modelId:underlying.modelId,system,user,maxOutputTokens}));
   const path=join(dir,`${inputHash}.json`);
   try{
    const old=JSON.parse(await readFile(path,'utf8')) as CacheRecord;
    const serialized=JSON.stringify(old.output);
    if(old.schemaVersion!=='1.0'||old.modelId!==underlying.modelId||old.inputHash!==inputHash||old.outputHash!==hash(serialized))throw new Error('Corrupted staged LLM checkpoint');
    return old.output;
   }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   if(usage.reservedCalls>=limits.maxCalls||usage.requestedOutputTokens+maxOutputTokens>limits.maxRequestedOutputTokens)
     throw new Error('LLM_BUDGET_BLOCKED: staged episode call/token cap reached; review before incurring additional cost');
   // Reserve before the external request: a crash can consume budget, never silently exceed it.
   const reserved:StagedBudgetUsage={...usage,reservedCalls:usage.reservedCalls+1,requestedOutputTokens:usage.requestedOutputTokens+maxOutputTokens};
   const tmp=join(dir,`budget-${process.pid}.tmp`);
   try{await writeFile(tmp,JSON.stringify(reserved)+'\n');await rename(tmp,budgetFile);}
   finally{await rm(tmp,{force:true});}
   usage=reserved;
   calls++;
   const output=await underlying.generateJson(system,user,maxOutputTokens);
   const serialized=JSON.stringify(output);
   if(!serialized||serialized.length>2_000_000)throw new Error('Oversized or invalid staged LLM output');
   const record:CacheRecord={schemaVersion:'1.0',modelId:underlying.modelId,inputHash,outputHash:hash(serialized),output};
   await writeFile(path,JSON.stringify(record)+'\n',{flag:'wx'});
   return output;
  }};
  return {provider,calls:()=>calls,usage:()=>({...usage}),close:async()=>{if(closed)return;closed=true;await lock.close();await rm(lockFile,{force:true});}};
 }catch(e){await lock.close();await rm(lockFile,{force:true});throw e;}
}
