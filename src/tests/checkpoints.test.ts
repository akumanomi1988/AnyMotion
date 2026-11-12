import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startStagedProviderSession} from '../story/checkpoints.js';
const brief={schemaVersion:'1.0' as const,episodeId:'EPCKP001',premise:'A family house sorting system becomes a ridiculous bureaucratic maze.',targetMinutes:9,priorSummaries:[]};
test('staged LLM requests are cached by inputs and verified, without repeated paid calls',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-staged-cache-'));
 let calls=0;
 const provider={modelId:'mock-model',generateJson:async()=>{calls++;return {x:'valid structured test result'};}};
 try{
  const first=await startStagedProviderSession(brief,provider,root);
  assert.deepEqual(await first.provider.generateJson('outline','user',2000),{x:'valid structured test result'});
  assert.equal(first.calls(),1);
  await assert.rejects(()=>startStagedProviderSession(brief,provider,root),/already active/);
  await first.close();
  const second=await startStagedProviderSession(brief,provider,root);
  assert.deepEqual(await second.provider.generateJson('outline','user',2000),{x:'valid structured test result'});
  assert.equal(second.calls(),0);assert.equal(calls,1);
  await second.close();
  await assert.rejects(()=>startStagedProviderSession({...brief,premise:'A different premise introduces a new conflict.'},provider,root),/request changed/);
  const folder=join(root,'workspace','drafts',brief.episodeId,'staged');
  const cache=(await readdir(folder)).find(x=>x.length===69&&x.endsWith('.json'))!;
  assert.ok(cache);
  const path=join(folder,cache);const record=JSON.parse(await readFile(path,'utf8')) as Record<string,unknown>;
  await writeFile(path,JSON.stringify({...record,output:{x:'manipulated'}}));
  const third=await startStagedProviderSession(brief,provider,root);
  try{await assert.rejects(()=>third.provider.generateJson('outline','user',2000),/Corrupted/);}finally{await third.close();}
 }finally{await rm(root,{recursive:true,force:true});}
});
