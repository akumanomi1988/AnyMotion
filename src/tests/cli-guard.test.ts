import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('YouTube CLI refuses an invalid confirmation before attempting OAuth or media access',()=>{
 for(const action of ['youtube-private','youtube-thumbnail']){
  const args=['dist/cli.js',action,'examples/pilot.json'];
  if(action==='youtube-private')args.push('--metadata','examples/youtube-metadata.example.json');
  args.push('--confirm','INVALID');
  const result=spawnSync(process.execPath,args,{encoding:'utf8',timeout:10_000,env:{...process.env,ANYMOTION_YOUTUBE_CLIENT_ID:'bad',ANYMOTION_YOUTUBE_CLIENT_SECRET:'bad',ANYMOTION_YOUTUBE_REFRESH_TOKEN:'bad'}});
  assert.equal(result.status,1,`${action}: ${result.stderr}`);
  assert.match(result.stderr,/confirmation required before OAuth/);
 }
});
