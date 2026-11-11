import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareDraftsWithCreativeMemory} from '../production/creative-context.js';
import {validateEpisode} from '../core/contracts.js';

const reference=validateEpisode(JSON.parse(await readFile('examples/episode-0002-editorial-draft.json','utf8')) as unknown);
const brief={schemaVersion:'1.0' as const,episodeId:reference.episodeId,targetMinutes:9,
 premise:'Vera y Leo intentan mantener un termostato a veintidós grados, pero ambos elaboran normas contradictorias para lograrlo.',priorSummaries:[]};

test('staged autopilot checkpoints ten scenes, repairs one scene and resumes without billable requests',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-staged-auto-'));
 let count=0,repairs=0;
 const provider={modelId:'mock-staged-v1',generateJson:async(system:string,user:string):Promise<unknown>=>{
  count++;
  if(system.includes('sitcom outline'))return {schemaVersion:'1.0',episodeId:reference.episodeId,title:reference.title,
   beats:reference.scenes.map(s=>({sceneId:s.sceneId,setId:s.setId,startMs:s.startMs,endMs:s.endMs,
    purpose:`Develop the domestic conflict in scene ${s.sceneId} with physical comedy`,
    conflictStep:`Escalate the temperature argument and consequences in ${s.sceneId}`}))};
  if(system.includes('Write one ORIGINAL')){
   const request=JSON.parse(user) as {beat:{sceneId:string}};
   if(request.beat.sceneId==='SC004'&&repairs++===0)return {...reference.scenes[3],sceneId:'WRONG'};
   return reference.scenes.find(s=>s.sceneId===request.beat.sceneId)!;
  }
  if(system.includes('expert comedy script localizer'))return {schemaVersion:'1.0',episodeId:reference.episodeId,locale:'en-US',
   lines:Object.fromEntries(reference.scenes.flatMap(s=>s.dialogue).map(l=>[l.lineId,'A measured English test line for the synthetic provider.']))};
  throw new Error('Unexpected LLM task');
 }};
 try{
  const first=await prepareDraftsWithCreativeMemory(brief,provider,root,'staged');
  assert.equal(first.llmCallsThisRun,2); // Two orchestrated steps; each staged model request is individually checkpointed.
  assert.equal(count,13); // Outline + ten valid scenes + one targeted retry + localization.
  assert.equal(repairs,2);
  const episode=validateEpisode(JSON.parse(await readFile(first.episodePath,'utf8')) as unknown);
  assert.equal(episode.scenes.length,10);
  assert.equal(first.assessment.status,'EDITORIAL_REVIEW_REQUIRED');
  const again=await prepareDraftsWithCreativeMemory(brief,provider,root,'staged');
  assert.equal(again.llmCallsThisRun,0);
  assert.equal(count,13);
  await assert.rejects(()=>prepareDraftsWithCreativeMemory(brief,provider,root,'single'),/generator revision/);
 }finally{await rm(root,{recursive:true,force:true});}
});
