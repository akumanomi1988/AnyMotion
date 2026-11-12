import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateVoiceAudition,VOICE_AUDITION_SAMPLES,type VoiceProvider,type ProbeAudio} from '../quality/voice-audition.js';
const wav=Buffer.alloc(128);
wav.write('RIFF',0,'ascii');wav.write('WAVE',8,'ascii');
const probe:ProbeAudio=async()=>({codec:'pcm_s16le',durationMs:2200,sampleRate:24000,channels:1});
const provider:VoiceProvider={providerId:'tts-http:audition-mock',async synthesize(_text,_locale,_actor,file){await writeFile(file,wav);}};
test('audition writes immutable eight-sample evidence with hashes but never editorial approval',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-audition-'));
 try{
  const {directory,receipt}=await generateVoiceAudition(provider,root,probe);
  assert.equal(receipt.status,'LISTENING_REVIEW_REQUIRED');
  assert.equal(receipt.samples.length,8);
  assert.deepEqual(receipt.samples.map(s=>s.key),VOICE_AUDITION_SAMPLES.map(s=>s.key));
  assert.ok(receipt.samples.every(s=>s.sha256.length===64&&s.audio.durationMs===2200));
  assert.equal((JSON.parse(await readFile(join(directory,'audition.json'),'utf8')) as typeof receipt).samples.length,8);
  await assert.rejects(()=>generateVoiceAudition(provider,root,probe),/already exists/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('failed audio leaves no published receipt, and other providers remain executable',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-audition-'));
 let attempts=0;
 const broken:VoiceProvider={providerId:'tts-http:broken-audition',async synthesize(_t,_l,_a,file){attempts++;await writeFile(file,attempts===3?Buffer.from('broken'):wav);}};
 try{
  await assert.rejects(()=>generateVoiceAudition(broken,root,probe),/Invalid WAV/);
  const ok=await generateVoiceAudition(provider,root,probe);
  assert.equal((await stat(join(ok.directory,'audition.json'))).isFile(),true);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('audition rejects unverified provider identity, zero-duration and wrong codec',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-audition-'));
 try{
  await assert.rejects(()=>generateVoiceAudition({...provider,providerId:'unknown'},root,probe),/identified HTTP/);
  await assert.rejects(()=>generateVoiceAudition(provider,root,async()=>({...await probe(''),durationMs:0})),/Unacceptable/);
  await assert.rejects(()=>generateVoiceAudition(provider,root,async()=>({...await probe(''),codec:'mp3'})),/Unacceptable/);
 }finally{await rm(root,{recursive:true,force:true});}
});
