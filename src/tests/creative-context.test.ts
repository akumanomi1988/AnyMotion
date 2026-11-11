import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createNineMinuteLoadFixture} from '../tools/load-fixture.js';
import {CreativeCatalog,draftFingerprint} from '../creative/catalog.js';
import {prepareDraftsWithCreativeMemory,pinnedCreativeBrief} from '../production/creative-context.js';
const original=createNineMinuteLoadFixture();
const brief={schemaVersion:'1.0' as const,episodeId:original.episodeId,targetMinutes:9,
 premise:'Vera y Leo quieren organizar los productos de casa pero su inventario crea nuevos problemas.',priorSummaries:[]};

test('creative history is pinned before LLM calls and reused on retry even if catalog changes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-creative-context-'));
 const db=new CreativeCatalog(join(root,'workspace','creative-catalog.sqlite'));
 try{
  const seed={...original,episodeId:'EP0200'};
  const prior={...brief,episodeId:'EP0200',premise:'Vera y Leo hacen un inventario absurdo de la despensa y pierden un objeto importante.'};
  db.registerDraft(seed,draftFingerprint(prior,seed));db.close();
  const frozen=await pinnedCreativeBrief(brief,root);
  assert.equal(frozen.priorSummaries.length,1);
  let calls=0;
  const provider={modelId:'mock-model',generateJson:async(system:string)=>{
   calls++;
   if(system.includes('localizer'))return {schemaVersion:'1.0',episodeId:original.episodeId,locale:'en-US',
    lines:Object.fromEntries(original.scenes.flatMap(s=>s.dialogue).map(l=>[l.lineId,'English diagnostic.']))};
   return original;
  }};
  const first=await prepareDraftsWithCreativeMemory(brief,provider,root);
  assert.equal(first.llmCallsThisRun,2);assert.equal(calls,2);
  assert(first.assessment.matches.some(m=>m.episodeId==='EP0200'));
  const second=await prepareDraftsWithCreativeMemory(brief,provider,root);
  assert.equal(second.llmCallsThisRun,0);assert.equal(calls,2);
  assert.equal(await readFile(first.episodePath,'utf8'),await readFile(second.episodePath,'utf8'));
  await assert.rejects(()=>pinnedCreativeBrief({...brief,premise:'A different household idea changes all creative assumptions and timings.'},root),/Pinned creative context/);
  const file=join(root,'workspace','drafts',brief.episodeId,'creative-context.json');
  await writeFile(file,(await readFile(file,'utf8')).replace('inventario','inventarioMODIFICADO'));
  await assert.rejects(()=>pinnedCreativeBrief(brief,root),/Pinned creative context/);
 }finally{await rm(root,{recursive:true,force:true});}
});
