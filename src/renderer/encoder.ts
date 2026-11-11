/** Backpressure-aware image2pipe encoder. Sharp raster frames are never written to disk. */
import {spawn} from 'node:child_process';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {rasterizeSvgFrame} from './raster.js';
import {renderSvgFrame} from './scene.js';
import type {Episode} from '../core/contracts.js';

export async function encodeSharpFrames(input:{episode:Episode;frames:number;width:number;height:number;fps:number;crf:number;output:string;onProgress?:(completed:number)=>void}):Promise<void>{
 if(!Number.isSafeInteger(input.frames)||input.frames<1||input.frames>18000)throw new Error('Invalid encoder frame count');
 const args=['-hide_banner','-loglevel','error','-nostdin','-y',
  '-f','image2pipe','-framerate',String(input.fps),'-vcodec','png','-i','pipe:0',
  '-frames:v',String(input.frames),'-an','-c:v','libx264','-preset','veryfast',
  '-crf',String(input.crf),'-pix_fmt','yuv420p','-movflags','+faststart',input.output];
 const child=spawn('ffmpeg',args,{shell:false,windowsHide:true,stdio:['pipe','ignore','pipe']});
 let errorLog='';
 child.stderr.on('data',(chunk:Buffer)=>{errorLog=(errorLog+chunk.toString()).slice(-8000);});
 const exited=new Promise<void>((resolve,reject)=>{
  child.once('error',reject);
  child.once('close',(code,signal)=>code===0?resolve():reject(new Error(`FFmpeg pipe failed: ${code??signal}; ${errorLog}`)));
 });
 async function* pngFrames():AsyncGenerator<Buffer>{
  for(let frame=0;frame<input.frames;frame++){
   const svg=renderSvgFrame(input.episode,frame,input.fps,input.width,input.height);
   yield await rasterizeSvgFrame(svg,input.width,input.height);
   const completed=frame+1;
   if(completed%Math.max(1,Math.floor(input.frames/5))===0||completed===input.frames)input.onProgress?.(completed);
  }
 }
 try{await Promise.all([pipeline(Readable.from(pngFrames()),child.stdin),exited]);}
 catch(e){child.kill('SIGKILL');throw e;}
}
