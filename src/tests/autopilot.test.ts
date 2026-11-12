import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareEpisodeDrafts} from '../production/autopilot.js';
import {createNineMinuteLoadFixture} from '../tools/load-fixture.js';

const original=createNineMinuteLoadFixture();
const brief={schemaVersion:'1.0',episodeId:'LOADTEST009',targetMinutes:9,premise:'An overly complicated household idea causes arguments.',priorSummaries:[]};

test('autopilot drafts exactly twice, resumes without paid calls and rejects changed artifacts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'anymotion-auto-'));
 let calls=0;
 const provider={modelId:'offline-fake-test',generateJson:async(system:string)=>{
  calls++;
  if(system.includes('localizer'))return {schemaVersion:'1.0',episodeId:original.episodeId,locale:'en-US',lines:Object.fromEntries(original.scenes.flatMap(s=>s.dialogue).map(l=>[l.lineId,'This is a test only.']))};
  return original;
 }};
 try{
  const first=await prepareEpisodeDrafts(brief,provider,dir);
  assert.equal(first.llmCallsThisRun,2);assert.equal(calls,2);
  assert.equal(first.receipt.status,'DRAFTS_READY_EDITORIAL_PENDING');
  const second=await prepareEpisodeDrafts(brief,provider,dir);
  assert.equal(second.llmCallsThisRun,0);assert.equal(calls,2);
  await assert.rejects(()=>prepareEpisodeDrafts({...brief,premise:'A different household conflict changes the original request.'},provider,dir),/another brief/);
  await writeFile(first.localizationPath,(await readFile(first.localizationPath,'utf8')).replace('This is a test only.','Changed, but still structurally valid.'));
  await assert.rejects(()=>prepareEpisodeDrafts(brief,provider,dir),/changed after generation/);
 }finally{await rm(dir,{force:true,recursive:true});}
});
