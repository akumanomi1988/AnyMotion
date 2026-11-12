/** Integration against the real OpenAI-compatible HTTP adapter, not a model-quality benchmark. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createNineMinuteLoadFixture} from '../tools/load-fixture.js';
import {OpenAICompatibleStoryProvider} from '../story/llm.js';
import {createStagedStory} from '../story/staged.js';

const fixture=createNineMinuteLoadFixture();
const brief={schemaVersion:'1.0' as const,episodeId:fixture.episodeId,premise:'Two partners try to organize an apartment drawer and find that the solution grows far more complicated.',targetMinutes:9,priorSummaries:[] as string[]};
const scenes=Array.from({length:6},(_,i)=>{
 const subset=fixture.scenes.slice(i*9,(i+1)*9);
 return {sceneId:`SC${String(i+1).padStart(3,'0')}`,setId:subset[0]!.setId,startMs:i*90000,endMs:(i+1)*90000,
  camera:subset.flatMap(s=>s.camera),actions:subset.flatMap(s=>s.actions),dialogue:subset.flatMap(s=>s.dialogue)};
});
const outline={schemaVersion:'1.0',episodeId:fixture.episodeId,title:'A nine minute diagnostic fixture',beats:scenes.map((scene,i)=>({
 sceneId:scene.sceneId,setId:scene.setId,startMs:scene.startMs,endMs:scene.endMs,
 purpose:`Develop the household obstacle through episode scene number ${i+1}`,
 conflictStep:`The proposed workaround creates more complications number ${i+1}`,
}))};

test('HTTP OpenAI-compatible staged producer assembles a nine-minute technical episode in seven calls',async()=>{
 let calls=0;
 const server=createServer(async(req,res)=>{
  calls++;
  assert.equal(req.method,'POST');
  assert.equal(req.headers.authorization,'Bearer integration-only');
  const bytes:Buffer[]=[];for await(const part of req)bytes.push(part as Buffer);
  const body=JSON.parse(Buffer.concat(bytes).toString('utf8')) as {model:string;max_completion_tokens:number;response_format:{type:string};messages:Array<{role:string;content:string}>};
  assert.equal(body.model,'integration-test-model');
  assert.equal(body.max_completion_tokens,4800);
  assert.equal(body.response_format.type,'json_object');
  const system=body.messages[0]!.content;
  let result:unknown;
  if(system.startsWith('Create an original')){
   assert.equal(calls,1);
   result=outline;
  }else{
   assert.ok(system.includes('production-ready Spanish sitcom scene'));
   const input=JSON.parse(body.messages[1]!.content) as {beat:{sceneId:string}};
   result=scenes.find(x=>x.sceneId===input.beat.sceneId);
   assert.ok(result);
  }
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address&&typeof address==='object');
 const provider=new OpenAICompatibleStoryProvider({endpoint:`http://127.0.0.1:${address.port}/v1/chat/completions`,apiKey:'integration-only',model:'integration-test-model'});
 try{
  const result=await createStagedStory(brief,provider);
  assert.equal(calls,7);
  assert.equal(result.llmCalls,7);
  assert.equal(result.episode.durationMs,540000);
  assert.equal(result.episode.scenes.length,6);
  assert.equal(result.episode.scenes.flatMap(s=>s.dialogue).length,108);
  assert.equal(result.model,'integration-test-model');
  assert.equal(result.episode.episodeId,fixture.episodeId);
 }finally{server.close();}
});