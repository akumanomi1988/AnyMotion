import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {validateEpisode} from '../core/contracts.js';
import {approveEditorial,verifyEditorialApproval,verifiedRelease} from '../publishing/approval.js';
import {validateVideoMetadata,uploadPrivateVideo,type Transport} from '../publishing/youtube.js';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const ep=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')) as unknown);
const metadata={title:'El cajón de todo - episodio uno',description:'Una discusión doméstica original sobre cómo ordenar un cajón y qué ocurre después.',categoryId:'24',madeForKids:false};
async function seed(root:string,voice='tts-http:approved-model-123'){
 const folder=join(root,'productions',ep.episodeId);
 const artifacts:Record<string,string>={};
 const files:Record<string,string|Buffer>={
  [`locales/es-ES/final_final.mp4`]:Buffer.alloc(3600,65),
  [`locales/en-US/final_final.mp4`]:Buffer.alloc(3600,66),
  [`locales/es-ES/dub-manifest.json`]:JSON.stringify({provider:voice,status:'LOCALIZED'}),
  [`locales/en-US/dub-manifest.json`]:JSON.stringify({provider:voice,status:'LOCALIZED'}),
  [`locales/es-ES/combined.srt`]:'1\n00:00:00,000 --> 00:00:01,000\nTest\n',
  [`locales/en-US/combined.srt`]:'1\n00:00:00,000 --> 00:00:01,000\nTest\n',
  [`locales/es-ES/vera.srt`]:'sample', [`locales/es-ES/leo.srt`]:'sample',
  [`locales/en-US/vera.srt`]:'sample', [`locales/en-US/leo.srt`]:'sample',
  [`locales/es-ES/speech-fit-report.json`]:'{}',
  [`locales/en-US/speech-fit-report.json`]:'{}',
  [`locales/es-ES/mux_final.json`]:'{}', [`locales/en-US/mux_final.json`]:'{}',
  ['final/silent.mp4']:Buffer.alloc(3600,12),
  ['final/manifest.json']:'{"status":"MASTER_RENDERED"}',
  ['final/quality-report.json']:'{"technicalPass":true}',
  ['timeline.json']:'{"status":"TIMELINE_FROZEN"}'
 };
 for(const [relative,data] of Object.entries(files)){
  const path=join(folder,relative);await mkdir(dirname(path),{recursive:true});await writeFile(path,data);
  artifacts[`productions/${ep.episodeId}/${relative}`]=sha(data);
 }
 const release={schemaVersion:'1.0',episodeId:ep.episodeId,preset:'final',locales:['es-ES','en-US'],status:'TECHNICAL_PASS_EDITORIAL_PENDING',publicationAllowed:false,artifacts,createdAt:new Date().toISOString()};
 await writeFile(join(folder,'release_final.json'),JSON.stringify(release,null,2)+'\n');
}
process.env.ANYMOTION_APPROVED_VOICE_PROVIDERS='production-voice,tts-http:approved-model-123';
const review={reviewer:'Test Producer',reviewNotes:'I have reviewed the entire episode for narrative quality, rights and correctness.',confirm:`APPROVE:${ep.episodeId}`,commercialRightsConfirmed:true};

test('invalid metadata, absent explicit flags and unsafe upload confirmations are rejected',async()=>{
 assert.throws(()=>validateVideoMetadata({...metadata,madeForKids:undefined}),/classification/);
 assert.throws(()=>validateVideoMetadata({...metadata,privacyStatus:'public'}),/Unknown/);
 assert.throws(()=>validateVideoMetadata({...metadata,title:'x'}),/Title/);
 await assert.rejects(()=>uploadPrivateVideo({episode:ep,metadata,accessToken:'token',confirm:'UPLOAD_PUBLIC'}),/confirmation/);
});

test('editorial signoff rejects previews, diagnostic voices and stale artifacts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-approval-'));
 try{
  await seed(root,'espeak-diagnostic');
  await assert.rejects(()=>approveEditorial(ep,review,root),/diagnostic/);
  await assert.rejects(()=>approveEditorial(ep,{...review,confirm:'yes'},root),/phrase/);
  await assert.rejects(()=>verifiedRelease(ep,'preview',root));
  await writeFile(join(root,'productions',ep.episodeId,'locales','en-US','combined.srt'),'tampered');
  await assert.rejects(()=>verifiedRelease(ep,'final',root),/changed/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('approved full release supports resumable private upload and remote privacy verification',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-youtube-'));
 try{
  await seed(root);
  await approveEditorial(ep,review,root);
  assert.equal((await verifyEditorialApproval(ep,root)).status,'EDITORIAL_APPROVED');
  const seen:{method:string;url:string;status?:string}[]=[];
  const transport:Transport=async(input,init)=>{
   const url=String(input),method=init?.method??'GET';
   seen.push({method,url,status:typeof init?.body==='string'?init.body:undefined});
   if(method==='POST'){
     const req=JSON.parse(String(init?.body)) as {status:{privacyStatus:string;selfDeclaredMadeForKids:boolean}};
     assert.equal(req.status.privacyStatus,'private');
     assert.equal(req.status.selfDeclaredMadeForKids,false);
     return new Response('',{status:200,headers:{location:'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test'}});
   }
   if(method==='PUT'&&init?.headers && 'Content-Range' in init.headers && init.headers['Content-Range'].startsWith('bytes */'))return new Response('',{status:308});
   if(method==='PUT')return new Response(JSON.stringify({id:'abcdefghijk'}),{status:201});
   if(method==='GET')return new Response(JSON.stringify({items:[{id:'abcdefghijk',status:{privacyStatus:'private'}}]}),{status:200});
   throw new Error(`Unexpected mock request ${method} ${url}`);
  };
  const result=await uploadPrivateVideo({episode:ep,metadata,accessToken:'test-token',confirm:`UPLOAD_PRIVATE:${ep.episodeId}`,root,transport});
  assert.equal(result.privacyStatus,'private');assert.equal(result.videoId,'abcdefghijk');
  assert.deepEqual(seen.map(s=>s.method),['POST','PUT','PUT','GET']);
  const second=await uploadPrivateVideo({episode:ep,metadata,accessToken:'test-token',confirm:`UPLOAD_PRIVATE:${ep.episodeId}`,root,transport});
  assert.equal(second.videoId,result.videoId);assert.equal(seen.length,4);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('remote privacy mismatch blocks receipt and leaves resumable upload session',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-youtube-'));
 try{
  await seed(root);await approveEditorial(ep,review,root);
  const transport:Transport=async(_input,init)=>{
   if(init?.method==='POST')return new Response('',{status:200,headers:{location:'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test'}});
   if(init?.method==='PUT' && ((init.headers as Record<string,string>)['Content-Range']??'').startsWith('bytes */'))return new Response('',{status:308});
   if(init?.method==='PUT')return new Response(JSON.stringify({id:'abcdefghijk'}),{status:200});
   return new Response(JSON.stringify({items:[{id:'abcdefghijk',status:{privacyStatus:'public'}}]}),{status:200});
  };
  await assert.rejects(()=>uploadPrivateVideo({episode:ep,metadata,accessToken:'token',confirm:`UPLOAD_PRIVATE:${ep.episodeId}`,root,transport}),/not verified private/);
  await assert.rejects(()=>readFile(join(root,'productions',ep.episodeId,'publication','youtube-private.json')));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('explicit provider allowlist blocks test fixtures and release hash binds voice metadata',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-voice-guard-'));
 try{
   await seed(root,'synthetic-ci-test');
   await assert.rejects(()=>approveEditorial(ep,review,root),/diagnostic/);
 }finally{await rm(root,{recursive:true,force:true});}
 const root2=await mkdtemp(join(tmpdir(),'anymotion-voice-hash-'));
 try{
   await seed(root2,'tts-http:approved-model-123');
   await approveEditorial(ep,review,root2);
   const p=join(root2,'productions',ep.episodeId,'locales','es-ES','dub-manifest.json');
   await writeFile(p,JSON.stringify({provider:'fabricated-voice',status:'LOCALIZED'}));
   await assert.rejects(()=>verifyEditorialApproval(ep,root2),/changed/);
 }finally{await rm(root2,{recursive:true,force:true});}
});
