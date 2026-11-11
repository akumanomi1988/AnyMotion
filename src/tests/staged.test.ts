import test from 'node:test';
import assert from 'node:assert/strict';
import {createNineMinuteLoadFixture} from '../tools/load-fixture.js';
import {createStagedStory,validateOutline} from '../story/staged.js';
const fixture=createNineMinuteLoadFixture();
const brief={schemaVersion:'1.0' as const,episodeId:fixture.episodeId,premise:'Two people repeatedly confront a house sorting decision that gets unnecessarily complicated.',targetMinutes:9,priorSummaries:[] as string[]};
const parts=Array.from({length:6},(_,i)=>{
 const chosen=fixture.scenes.slice(i*9,(i+1)*9);
 return {sceneId:`SC${String(i+1).padStart(3,'0')}`,setId:chosen[0]!.setId,startMs:i*90000,endMs:(i+1)*90000,
  camera:chosen.flatMap(s=>s.camera),actions:chosen.flatMap(s=>s.actions),dialogue:chosen.flatMap(s=>s.dialogue)};
});
const outline={schemaVersion:'1.0',episodeId:fixture.episodeId,title:'A nine minute diagnostic fixture',beats:parts.map((p,i)=>({sceneId:p.sceneId,setId:p.setId,startMs:p.startMs,endMs:p.endMs,
 purpose:`Develop escalating obstacle number ${i+1} for a household setup`,conflictStep:`The workaround creates new complications number ${i+1}`}))};
test('staged pipeline composes bounded validated scenes into one 9-minute episode',async()=>{
 let count=0;
 const provider={modelId:'mock-story-provider',generateJson:async(system:string,user:string)=>{
  count++;
  if(system.startsWith('Create an original'))return outline;
  const beat=(JSON.parse(user) as {beat:{sceneId:string}}).beat;
  return parts.find(s=>s.sceneId===beat.sceneId)!;
 }};
 const result=await createStagedStory(brief,provider);
 assert.equal(result.episode.scenes.length,6);
 assert.equal(result.episode.durationMs,540000);
 assert.equal(result.episode.scenes.flatMap(s=>s.dialogue).length,108);
 assert.equal(result.llmCalls,7);
 assert.equal(count,7);
});
test('staged pipeline repairs malformed scene locally once, without discarding earlier scenes',async()=>{
 let count=0;
 const provider={modelId:'mock-repair-provider',generateJson:async(system:string,user:string)=>{
  count++;
  if(system.startsWith('Create an original'))return outline;
  const beat=(JSON.parse(user) as {beat:{sceneId:string}}).beat;
  const index=parts.findIndex(s=>s.sceneId===beat.sceneId);
  return count===2?{...parts[index],camera:[{atMs:20,shot:'invalid'}]}:parts[index]!;
 }};
 const result=await createStagedStory(brief,provider);
 assert.equal(result.llmCalls,8);
 assert.equal(result.episode.scenes.length,6);
});
test('staged outline rejects gaps, new sets, and duplicate scenes',()=>{
 assert.throws(()=>validateOutline({...outline,beats:outline.beats.slice(1)},brief),/partition/);
 assert.throws(()=>validateOutline({...outline,beats:[...outline.beats.slice(0,5),{...outline.beats[5],sceneId:'SC001'}]},brief),/Duplicate/);
 assert.throws(()=>validateOutline({...outline,beats:outline.beats.map((b,i)=>i===3?{...b,setId:'new-set'}:b)},brief),/Unknown set/);
});
