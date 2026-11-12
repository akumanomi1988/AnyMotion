import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateEpisode} from '../core/contracts.js';
import {sourceLocalization,validateLocalization,dubEpisode,runTool} from '../audio/dubbing.js';

const deps=['espeak','ffmpeg','ffprobe'];
const available=deps.every(bin=>spawnSync(bin,['-version'],{stdio:'ignore'}).status===0||spawnSync(bin,['--version'],{stdio:'ignore'}).status===0);

test('localizations require exactly stable dialogue IDs and known locale',async()=>{
 const ep=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')));
 const original=sourceLocalization(ep);
 assert.equal(Object.keys(original.lines).length,14);
 assert.equal(validateLocalization(original,ep,'es-ES'),original);
 assert.throws(()=>validateLocalization({...original,lines:{...original.lines,DL999:'Hello'}},ep,'es-ES'),/exactly/);
 assert.throws(()=>validateLocalization({...original,locale:'en-US'},ep,'es-ES'),/mismatch/);
 assert.throws(()=>validateLocalization({...original,lines:{...original.lines,DL001:''}},ep,'es-ES'),/Invalid localized line/);
});

test('real offline TTS creates reproducible full-length stems without truncation',{skip:!available,timeout:60_000},async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'anymotion-audio-test-'));
 try{
  const ep=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')));
  const source=sourceLocalization(ep);
  const manifest=await dubEpisode(ep,source,'es-ES',tmp);
  assert.equal(manifest.clips.length,14);
  assert.equal(manifest.status,'LOCALIZED');
  assert.ok(manifest.clips.every(clip=>clip.fittedDurationMs<=clip.windowMs+1 && !clip.clipped));
  const sound=join(tmp,'productions','EP0001','locales','es-ES','dialogue.wav');
  const file=await stat(sound);
  assert.equal(file.size,44+78000*24*2);
  const again=await dubEpisode(ep,source,'es-ES',tmp);
  assert.deepEqual(again,manifest);
  await assert.rejects(()=>dubEpisode(ep,{...source,lines:{...source.lines,DL001:'Otro texto'}},'es-ES',tmp),/Inputs changed/);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
