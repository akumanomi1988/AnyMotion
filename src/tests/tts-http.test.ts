import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {HttpTtsProvider,configuredHttpTts} from '../audio/tts-http.js';
const voices={'es-ES':{vera:'spanish_female',leo:'spanish_male'},'en-US':{vera:'english_female',leo:'english_male'}} as const;
const wave=()=>{const data=Buffer.alloc(44+4800);data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(24000,24);data.writeUInt32LE(48000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(4800,40);return data;};

test('commercial TTS adapter requires secure endpoint and stable voice profiles',()=>{
 assert.throws(()=>new HttpTtsProvider({endpoint:'http://tts.example/v1/audio/speech',model:'model',voices:{...voices}}),/HTTPS/);
 assert.throws(()=>new HttpTtsProvider({endpoint:'http://127.0.0.1:8888/v1/audio/speech',model:'model',voices:{'es-ES':{vera:'',leo:'m'},'en-US':voices['en-US']}}),/Missing TTS voice/);
 assert.equal(configuredHttpTts({}),undefined);
});

test('HTTP TTS preserves voice mapping, WAV output and never logs auth',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-http-'));
 try{
  let called=0;
  const provider=new HttpTtsProvider({endpoint:'http://127.0.0.1:8888/v1/audio/speech',model:'kokoro',voices:{...voices},apiKey:'secret'},async(_url,init)=>{
   called++;
   assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer secret');
   const request=JSON.parse(String(init?.body)) as {voice:string;speed:number;response_format:string};
   assert.equal(request.voice,'spanish_female');assert.equal(request.speed,1.08);assert.equal(request.response_format,'wav');
   return new Response(wave(),{status:200});
  });
  const output=join(root,'clip.wav');await provider.synthesize('Una frase de prueba','es-ES','vera',output,1.08);
  assert.equal(called,1);assert.match(provider.providerId,/^tts-http:/);
  assert.equal((await readFile(output)).length,4844);
 }finally{await rm(root,{recursive:true,force:true});}
});
