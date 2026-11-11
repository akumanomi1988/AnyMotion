/** Content-addressed LLM call checkpoints: resume without rebilling completed stages. */
import {createHash} from 'node:crypto';
import {mkdir,open,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {withinRoot} from '../core/filenames.js';
import {validateStoryBrief,type StoryBrief,type StructuredStoryProvider} from './llm.js';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
interface RequestRecord {schemaVersion:'1.0';episodeId:string;modelId:string;briefHash:string}
interface CacheRecord {schemaVersion:'1.0';modelId:string;inputHash:string;outputHash:string;output:unknown}
export interface StagedProviderSession {provider:StructuredStoryProvider;close:()=>Promise<void>;calls:()=>number}
/** One active writer per episode, with strict request identity and digest-verified JSON. */
export async function startStagedProviderSession(briefInput:StoryBrief,underlying:StructuredStoryProvider,root=resolve(process.cwd())):Promise<StagedProviderSession>{
 const brief=validateStoryBrief(briefInput);
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
  const provider:StructuredStoryProvider={modelId:underlying.modelId,generateJson:async(system,user,maxOutputTokens)=>{
   if(closed)throw new Error('Staged session already closed');
   const inputHash=hash(JSON.stringify({modelId:underlying.modelId,system,user,maxOutputTokens}));
   const path=join(dir,`${inputHash}.json`);
   try{
    const old=JSON.parse(await readFile(path,'utf8')) as CacheRecord;
    const serialized=JSON.stringify(old.output);
    if(old.schemaVersion!=='1.0'||old.modelId!==underlying.modelId||old.inputHash!==inputHash||old.outputHash!==hash(serialized))throw new Error('Corrupted staged LLM checkpoint');
    return old.output;
   }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   calls++;
   const output=await underlying.generateJson(system,user,maxOutputTokens);
   const serialized=JSON.stringify(output);
   if(!serialized||serialized.length>2_000_000)throw new Error('Oversized or invalid staged LLM output');
   const record:CacheRecord={schemaVersion:'1.0',modelId:underlying.modelId,inputHash,outputHash:hash(serialized),output};
   await writeFile(path,JSON.stringify(record)+'\n',{flag:'wx'});
   return output;
  }};
  return {provider,calls:()=>calls,close:async()=>{if(closed)return;closed=true;await lock.close();await rm(lockFile,{force:true});}};
 }catch(e){await lock.close();await rm(lockFile,{force:true});throw e;}
}
