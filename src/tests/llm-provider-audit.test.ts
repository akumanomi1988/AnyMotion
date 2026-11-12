import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditLlmProvider,verifyLlmProbeResponse,verifyStoredLlmAudit} from '../quality/llm-provider-audit.js';
import {OpenAICompatibleStoryProvider} from '../story/llm.js';

const challenge='e'.repeat(32);
const response={protocolVersion:'1.0',challenge,language:'es-ES',supportsStructuredJson:true};

test('probe validates exact schema, value echo and unexpected fields',()=>{
 assert.deepEqual(verifyLlmProbeResponse(response,challenge),response);
 assert.throws(()=>verifyLlmProbeResponse({...response,challenge:'a'.repeat(32)},challenge),/challenge/);
 assert.throws(()=>verifyLlmProbeResponse({...response,unverified:true},challenge),/fields/);
 assert.throws(()=>verifyLlmProbeResponse({...response,supportsStructuredJson:'true'},challenge),/challenge/);
});

test('real OpenAI-compatible HTTP exchange proves auth, JSON, token cap and immutable evidence',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-llm-audit-'));
 let count=0;
 const server=createServer(async(req,res)=>{
  count++;
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk as Buffer);
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8')) as {model:string;max_completion_tokens:number;response_format:{type:string};messages:Array<{content:string}>};
  assert.equal(req.method,'POST');assert.equal(req.headers.authorization,'Bearer local-test-key');
  assert.equal(body.max_completion_tokens,160);assert.equal(body.model,'integration-model');
  assert.equal(body.response_format.type,'json_object');
  const requested=JSON.parse(body.messages[1]!.content) as typeof response;
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({supportsStructuredJson:true,language:'es-ES',challenge:requested.challenge,protocolVersion:'1.0'})}}]}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address&&typeof address==='object');
 const endpoint=`http://127.0.0.1:${address.port}/v1/chat/completions`;
 const provider=new OpenAICompatibleStoryProvider({endpoint,model:'integration-model',apiKey:'local-test-key'});
 try{
  const result=await auditLlmProvider(provider,endpoint,root,()=>challenge);
  assert.equal(result.receipt.status,'JSON_PROTOCOL_VERIFIED_EDITORIAL_PENDING');
  assert.equal(result.receipt.requestsUsed,1);assert.equal(count,1);
  assert.equal((await verifyStoredLlmAudit(result.directory)).response.challenge,challenge);
  const saved=await readFile(join(result.directory,'provider-audit.json'),'utf8');
  assert.equal(saved.includes('local-test-key'),false);
  await assert.rejects(()=>auditLlmProvider(provider,endpoint,root,()=>challenge),/already exists/);
  assert.equal(count,1,'cache check must never trigger another paid request');
  await writeFile(join(result.directory,'provider-audit.json'),saved.replace('integration-model','tampered-model').replace('"supportsStructuredJson": true','"supportsStructuredJson": false'));
  await assert.rejects(()=>verifyStoredLlmAudit(result.directory),/invalid/);
 }finally{server.close();await rm(root,{force:true,recursive:true});}
});

test('failed provider probe does not publish a receipt or count a positive verification',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-llm-audit-'));
 const endpoint='https://llm.example.test/v1/chat/completions';
 try{
  await assert.rejects(()=>auditLlmProvider({modelId:'refusal-model',generateJson:async()=>({...response,challenge:'wrong'})},endpoint,root,()=>challenge),/challenge/);
  const accepted=await auditLlmProvider({modelId:'refusal-model',generateJson:async()=>response},endpoint,root,()=>challenge);
  assert.equal(accepted.receipt.response.challenge,challenge);
 }finally{await rm(root,{force:true,recursive:true});}
});

test('probe fails closed on unauthorized endpoint or invalid challenge before paid request',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-llm-audit-'));
 let calls=0;const provider={modelId:'configured-model',generateJson:async()=>{calls++;return response;}};
 try{
  await assert.rejects(()=>auditLlmProvider(provider,'http://remote.example.com/v1/chat/completions',root,()=>challenge),/HTTPS/);
  await assert.rejects(()=>auditLlmProvider(provider,'https://example.com/v1#fragment',root,()=>challenge),/fragments/);
  await assert.rejects(()=>auditLlmProvider(provider,'https://example.com/v1',root,()=>'bad'),/challenge/);
  assert.equal(calls,0);
 }finally{await rm(root,{force:true,recursive:true});}
});
