import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startStagedProviderSession} from '../story/checkpoints.js';
const brief={schemaVersion:'1.0' as const,episodeId:'EP0909',premise:'A husband and wife try to agree on how to clean the living room.',targetMinutes:9,priorSummaries:[]};

test('LLM budget reservations survive process restart and do not charge cached completions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-budget-'));
 let calls=0;
 const upstream={modelId:'mock-costed-v1',generateJson:async()=>{calls++;return {response:'original mock result'};}};
 const limits={maxCalls:1,maxRequestedOutputTokens:100};
 try{
  const first=await startStagedProviderSession(brief,upstream,root,limits);
  assert.deepEqual(await first.provider.generateJson('story','one',60),{response:'original mock result'});
  await assert.rejects(()=>first.provider.generateJson('story','two',50),/LLM_BUDGET_BLOCKED/);
  assert.equal(first.usage().reservedCalls,1);
  await first.close();
  const replay=await startStagedProviderSession(brief,upstream,root,limits);
  assert.deepEqual(await replay.provider.generateJson('story','one',60),{response:'original mock result'});
  assert.equal(replay.calls(),0);
  await assert.rejects(()=>replay.provider.generateJson('story','different',60),/LLM_BUDGET_BLOCKED/);
  assert.equal(replay.usage().requestedOutputTokens,60);
  await replay.close();
  assert.equal(calls,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('missing or invalid cost limits stop work before LLM request',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-budget-'));
 try{
  await assert.rejects(()=>startStagedProviderSession(brief,{modelId:'test',generateJson:async()=>({})},root,{maxCalls:0,maxRequestedOutputTokens:100}),/Invalid LLM budget/);
 }finally{await rm(root,{recursive:true,force:true});}
});
