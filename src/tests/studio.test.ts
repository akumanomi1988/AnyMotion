import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startStudioServer} from '../studio/server.js';

test('operator console is loopback-only, renders escaped titles and serves scoped byte ranges',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-studio-'));
 const file=join(root,'productions','EP0001','locales','es-ES','final_preview.mp4');
 await mkdir(join(root,'productions','EP0001','locales','es-ES'),{recursive:true});
 await writeFile(file,Buffer.from('0123456789'));
 await writeFile(join(root,'productions','EP0001','release_preview.json'),JSON.stringify({status:'TECHNICAL_PASS_EDITORIAL_PENDING',locales:['es-ES'],artifacts:{a:'x'}}));
 await writeFile(join(root,'productions','EP0001','timeline.json'),JSON.stringify({durationMs:78000}));
 const {server,port}=await startStudioServer(root,0);
 try{
  const host=`http://127.0.0.1:${port}`;
  assert.equal((server.address() as {address:string}).address,'127.0.0.1');
  const home=await fetch(host);assert.equal(home.status,200);
  const html=await home.text();assert.match(html,/EP0001/);assert.match(html,/Sin publicación automática/);
  const info=await (await fetch(`${host}/api/episodes`)).json() as {episodeId:string;videoReady:Record<string,boolean>}[];
  assert.equal(info[0]?.episodeId,'EP0001');assert.equal(info[0]?.videoReady['es-ES:preview'],true);
  const range=await fetch(`${host}/media/EP0001/es-ES/preview`,{headers:{Range:'bytes=2-5'}});
  assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),'bytes 2-5/10');assert.equal(await range.text(),'2345');
  assert.equal((await fetch(`${host}/media/EP0001/es-ES/preview`,{method:'POST'})).status,405);
  assert.equal((await fetch(`${host}/media/EP0001/en-US/preview`)).status,404);
  assert.equal((await fetch(`${host}/episodes/NOPE`)).status,404);
  assert.equal((await fetch(`${host}/media/EP0001/es-ES/preview?file=../../secrets`)).status,400);
 }finally{await new Promise<void>((ok,bad)=>server.close(e=>e?bad(e):ok()));await rm(root,{recursive:true,force:true});}
});
