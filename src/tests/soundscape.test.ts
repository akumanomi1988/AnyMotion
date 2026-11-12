import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateEpisode} from '../core/contracts.js';
import {createSoundscape,verifySoundscape,validateSoundDesign,assertWav,mixSoundtrack} from '../audio/soundscape.js';
import {dubEpisode,sourceLocalization} from '../audio/dubbing.js';
const episode=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')) as unknown);
const design=JSON.parse(await readFile('examples/pilot.sound-design.json','utf8')) as unknown;

 test('sound design contract forbids invalid identifiers, unsupported effects and gain',()=>{
  assert.equal(validateSoundDesign(design,episode).episodeId,episode.episodeId);
  const original=validateSoundDesign(design,episode);
  assert.throws(()=>validateSoundDesign({...original,cues:[{...original.cues[0],effect:'loadExternalFile'}]},episode),/Invalid sound cue/);
  assert.throws(()=>validateSoundDesign({...original,cues:[{...original.cues[0],gain:1.5}]},episode),/Invalid sound cue/);
  assert.throws(()=>validateSoundDesign({...original,cues:[original.cues[0],original.cues[0]]},episode),/Invalid sound cue/);
  assert.throws(()=>validateSoundDesign({...original,music:{introMs:20000,outroMs:0,gain:.05}},episode),/Invalid original music/);
  assert.throws(()=>validateSoundDesign({...original,unknown:'please render'},episode),/schema/);
 });

test('soundscape is deterministic, has independent WAV stems and blocks tampering',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-sound-'));
 try{
  assert.equal(await verifySoundscape(episode,root),null);
  const first=await createSoundscape(episode,design,root);
  const again=await createSoundscape(episode,design,root);
  assert.deepEqual(again,first);
  const loaded=await verifySoundscape(episode,root);
  assert.ok(loaded);
  assertWav(loaded.music,episode.durationMs);
  assertWav(loaded.sfx,episode.durationMs);
  assert.notEqual(first.files['music.wav'],first.files['sfx.wav']);
  assert.ok(loaded.music.subarray(44).some(n=>n!==0));
  assert.ok(loaded.sfx.subarray(44).some(n=>n!==0));
  await assert.rejects(()=>createSoundscape(episode,{...validateSoundDesign(design,episode),cues:[]},root),/design changed/);
  const musicFile=join(root,'productions',episode.episodeId,'audio','music.wav');
  const altered=await readFile(musicFile);altered[80]=altered[80]!^1;await writeFile(musicFile,altered);
  await assert.rejects(()=>verifySoundscape(episode,root),/hash mismatch/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('mixing never clips and rejects mismatched WAV lengths',()=>{
 const zeros=Buffer.alloc(44+48000);
 zeros.write('RIFF',0);zeros.writeUInt32LE(48036,4);zeros.write('WAVEfmt ',8);
 zeros.writeUInt32LE(16,16);zeros.writeUInt16LE(1,20);zeros.writeUInt16LE(1,22);zeros.writeUInt32LE(24000,24);
 zeros.writeUInt32LE(48000,28);zeros.writeUInt16LE(2,32);zeros.writeUInt16LE(16,34);zeros.write('data',36);zeros.writeUInt32LE(48000,40);
 const voice=Buffer.from(zeros);voice.writeInt16LE(32000,44);
 const sfx=Buffer.from(zeros);sfx.writeInt16LE(2000,44);
 assert.throws(()=>mixSoundtrack(voice,zeros,sfx,1000),/clipping/);
 assert.throws(()=>mixSoundtrack(voice,zeros,sfx,1001),/Invalid.*WAV/);
});

const mediaAvailable=['ffmpeg','ffprobe'].every(name=>spawnSync(name,['-version'],{stdio:'ignore'}).status===0);
test('localized dialogue keeps its own stem and mixes reusable original music/SFX',{skip:!mediaAvailable,timeout:120_000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-mixed-audio-'));
 const existing=process.env.ANYMOTION_TEST_VOICE;
 try{
  process.env.ANYMOTION_TEST_VOICE='synthetic';
  await createSoundscape(episode,design,root);
  const es=await dubEpisode(episode,sourceLocalization(episode),'es-ES',root);
  const folder=join(root,'productions',episode.episodeId,'locales','es-ES');
  const dialogue=await readFile(join(folder,'dialogue.wav'));
  const full=await readFile(join(folder,'full_audio.wav'));
  assert.ok(es.soundtrackManifestSha256);
  assertWav(dialogue,episode.durationMs);
  assertWav(full,episode.durationMs);
  assert.notDeepEqual(full,dialogue);
  const reused=await dubEpisode(episode,sourceLocalization(episode),'es-ES',root);
  assert.deepEqual(reused,es);
  const soundFile=join(root,'productions',episode.episodeId,'audio','sfx.wav');
  const changed=await readFile(soundFile);changed[50]=changed[50]!^1;await writeFile(soundFile,changed);
  await assert.rejects(()=>dubEpisode(episode,sourceLocalization(episode),'es-ES',root),/hash mismatch/);
 }finally{
  if(existing===undefined)delete process.env.ANYMOTION_TEST_VOICE;else process.env.ANYMOTION_TEST_VOICE=existing;
  await rm(root,{recursive:true,force:true});
 }
});
