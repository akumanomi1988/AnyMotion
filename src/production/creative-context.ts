/** Pins a creative-memory snapshot for each episode before any billable model calls. */
import {createHash} from 'node:crypto';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {withinRoot} from '../core/filenames.js';
import {validateStoryBrief,type StoryBrief,type StructuredStoryProvider} from '../story/llm.js';
import {CreativeCatalog,draftFingerprint,type CatalogAssessment} from '../creative/catalog.js';
import {prepareEpisodeDrafts,type PreparedDrafts} from './autopilot.js';
import {validateEpisode} from '../core/contracts.js';

interface ContextSnapshot {schemaVersion:'1.0';episodeId:string;sourceHash:string;resolvedHash:string;brief:StoryBrief}
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exists=(path:string)=>stat(path).then(()=>true,(e:NodeJS.ErrnoException)=>e.code==='ENOENT'?false:Promise.reject(e));

export async function pinnedCreativeBrief(input:unknown,root=resolve(process.cwd())):Promise<StoryBrief>{
 const original=validateStoryBrief(input);
 const base=resolve(root);
 const folder=withinRoot(base,join('workspace','drafts',original.episodeId));
 const snapshotFile=join(folder,'creative-context.json');
 const existingRequest=join(folder,'request.json');
 const old=await exists(snapshotFile);
 if(old){
  const snapshot=JSON.parse(await readFile(snapshotFile,'utf8')) as ContextSnapshot;
  const parsed=validateStoryBrief(snapshot.brief);
  if(snapshot.schemaVersion!=='1.0'||snapshot.episodeId!==original.episodeId||
   snapshot.sourceHash!==digest(original)||snapshot.resolvedHash!==digest(parsed))
   throw new Error('Pinned creative context is missing, corrupt, or belongs to another premise');
  return parsed;
 }
 // Backward compatibility: preserve a legacy request previously generated without creative memory.
 if(await exists(existingRequest)){
  const previous=JSON.parse(await readFile(existingRequest,'utf8')) as {briefHash?:string};
  if(previous.briefHash!==digest(original))throw new Error('Existing draft request is for a different brief');
  return original;
 }
 const catalog=new CreativeCatalog(join(base,'workspace','creative-catalog.sqlite'));
 let resolved:StoryBrief;
 try{resolved=catalog.contextualizeBrief(original);}finally{catalog.close();}
 const snapshot:ContextSnapshot={schemaVersion:'1.0',episodeId:original.episodeId,sourceHash:digest(original),resolvedHash:digest(resolved),brief:resolved};
 await mkdir(folder,{recursive:true});
 await writeFile(snapshotFile,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
 return resolved;
}

export async function prepareDraftsWithCreativeMemory(input:unknown,provider:StructuredStoryProvider,root=resolve(process.cwd())):
 Promise<PreparedDrafts & {assessment:CatalogAssessment}> {
 const original=validateStoryBrief(input);
 const pinned=await pinnedCreativeBrief(original,root);
 const drafts=await prepareEpisodeDrafts(pinned,provider,root);
 const episode=validateEpisode(JSON.parse(await readFile(drafts.episodePath,'utf8')) as unknown);
 const catalog=new CreativeCatalog(join(resolve(root),'workspace','creative-catalog.sqlite'));
 try {
  const fingerprint=draftFingerprint(original,episode);
  const assessment=catalog.assess(fingerprint);
  catalog.registerDraft(episode,fingerprint);
  return {...drafts,assessment};
 }finally{catalog.close();}
}
