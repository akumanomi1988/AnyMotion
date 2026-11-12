import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {validateEpisode} from '../core/contracts.js';
import {freezeTimeline} from '../timeline/freeze.js';
import type {DubManifest} from '../audio/dubbing.js';

test('source speech is required to freeze the timeline; revisions are immutable',async()=>{
 const ep=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')));
 const lines=ep.scenes.flatMap(s=>s.dialogue);
 const voice:DubManifest={schemaVersion:'1.0',status:'LOCALIZED',episodeId:ep.episodeId,locale:'es-ES',provider:'fixture-voice',timelineSha256:createHash('sha256').update(JSON.stringify(ep)).digest('hex'),localizationSha256:'fixture',clips:lines.map(l=>({lineId:l.lineId,characterId:l.characterId,sourceDurationMs:1000,fittedDurationMs:900,windowMs:l.endMs-l.startMs,speakingRate:220,tempo:1,clipped:false})),files:{}};
 const root=await mkdtemp(join(tmpdir(),'anymotion-timeline-'));
 try{
  const first=await freezeTimeline(ep,voice,root);
  assert.equal(first.status,'TIMELINE_FROZEN');
  assert.equal(first.lineTimings.length,14);
  assert.deepEqual(await freezeTimeline(ep,voice,root),first);
  const changed=structuredClone(voice);changed.clips[0]!.sourceDurationMs=1200;
  await assert.rejects(()=>freezeTimeline(ep,changed,root),/revision/);
  await assert.rejects(()=>freezeTimeline(ep,{...voice,locale:'en-US'},root),/Source speech/);
 }finally{await rm(root,{recursive:true,force:true});}
});
