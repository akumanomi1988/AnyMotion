import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyMaster} from '../production/master.js';
import {validateEpisode} from '../core/contracts.js';
const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const ep=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')) as unknown);

test('existing master is reused only if revision, files and QA are intact',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-master-'));
 try{
  const d=join(root,'productions',ep.episodeId,'preview');await mkdir(d,{recursive:true});
  const movie=join(d,'silent.mp4');await writeFile(movie,Buffer.alloc(1500,42));
  const srt=join(root,'productions',ep.episodeId,'locales','es-ES','vera.srt');await mkdir(dirname(srt),{recursive:true});await writeFile(srt,'sample');
  const artifacts=[{path:`productions/${ep.episodeId}/preview/silent.mp4`,sha256:sha(await readFile(movie))},
   {path:`productions/${ep.episodeId}/locales/es-ES/vera.srt`,sha256:sha('sample')}];
  await writeFile(join(d,'manifest.json'),JSON.stringify({schemaVersion:'1.0',episodeId:ep.episodeId,status:'MASTER_RENDERED',durationMs:ep.durationMs,sourceHash:sha(JSON.stringify(ep)),artifacts}));
  await writeFile(join(d,'quality-report.json'),JSON.stringify({technicalPass:true}));
  assert.equal(await verifyMaster(ep,'preview',root),movie);
  await writeFile(srt,'altered');
  await assert.rejects(()=>verifyMaster(ep,'preview',root),/modified/);
  await writeFile(srt,'sample');await writeFile(movie,Buffer.alloc(1500,99));
  await assert.rejects(()=>verifyMaster(ep,'preview',root),/modified/);
 }finally{await rm(root,{recursive:true,force:true});}
});
