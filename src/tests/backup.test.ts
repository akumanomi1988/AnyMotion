import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateEpisode} from '../core/contracts.js';
import {backupEpisode,restoreEpisodeBackup,verifyEpisodeBackup} from '../production/backup.js';
const ep=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')));

test('backups verify every file, are idempotent and restore without overwriting',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-backup-test-'));
 const workspace=join(root,'source'),restore=join(root,'recovered'),archive=join(root,'archives');
 try{
  const folder=join(workspace,'productions',ep.episodeId,'locales','es-ES');
  await mkdir(folder,{recursive:true});
  await writeFile(join(folder,'dialogue.wav'),Buffer.alloc(8000,3));
  await writeFile(join(folder,'combined.srt'),'1\n00:00:01,000 --> 00:00:02,000\nDemo\n');
  const first=await backupEpisode(ep,archive,workspace);
  assert.equal(Object.keys(first.files).length,2);
  assert.deepEqual(await backupEpisode(ep,archive,workspace),first);
  assert.deepEqual(await verifyEpisodeBackup(ep,archive),first);
  const result=await restoreEpisodeBackup(ep,archive,restore);
  assert.deepEqual(result,first);
  assert.equal((await readFile(join(restore,'productions',ep.episodeId,'locales','es-ES','dialogue.wav'))).length,8000);
  await assert.rejects(()=>restoreEpisodeBackup(ep,archive,restore),/overwrite/);
  const path=join(archive,ep.episodeId,first.episodeSha256,'locales','es-ES','dialogue.wav');
  await writeFile(path,Buffer.alloc(8000,4));
  await assert.rejects(()=>verifyEpisodeBackup(ep,archive),/Corrupt/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('backups never write inside productions and need real source files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-backup-boundary-'));
 try {
  await assert.rejects(()=>backupEpisode(ep,join(root,'archive'),root),/no production artifacts/);
  await mkdir(join(root,'productions',ep.episodeId),{recursive:true});
  await writeFile(join(root,'productions',ep.episodeId,'demo.txt'),'content');
  await assert.rejects(()=>backupEpisode(ep,join(root,'productions','archives'),root),/nested inside/);
 }finally{await rm(root,{recursive:true,force:true});}
});
