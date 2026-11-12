/** Bounded, auditable real-provider voice audition. Never automatically approved. */
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import type {CharacterId} from '../core/contracts.js';
import type {Locale} from '../audio/dubbing.js';

const execFileAsync=promisify(execFile);
const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
export interface VoiceProvider {
 readonly providerId:string;
 synthesize(text:string,locale:Locale,actor:CharacterId,file:string,speed?:number):Promise<void>;
}
export interface AudioProbe {codec:string;durationMs:number;sampleRate:number;channels:number}
export type ProbeAudio=(file:string)=>Promise<AudioProbe>;
export interface VoiceSample {locale:Locale;actor:CharacterId;key:string;text:string}
export const VOICE_AUDITION_SAMPLES:readonly VoiceSample[]=[
 {locale:'es-ES',actor:'vera',key:'dry-humor',text:'Fantástico. Has convertido la lista de la compra en una auditoría internacional.'},
 {locale:'es-ES',actor:'vera',key:'surprise',text:'¿Cómo que el frigorífico necesita una contraseña? ¡Solo quiero un yogur!'},
 {locale:'es-ES',actor:'leo',key:'confidence',text:'He diseñado un sistema infalible. Bueno, infalible salvo por un pequeño detalle.'},
 {locale:'es-ES',actor:'leo',key:'uncertainty',text:'Espera... ¿dónde he guardado el manual para abrir el cajón?'},
 {locale:'en-US',actor:'vera',key:'dry-humor',text:'Fantastic. You turned the grocery list into an international audit.'},
 {locale:'en-US',actor:'vera',key:'surprise',text:'What do you mean the fridge needs a password? I just want some yogurt!'},
 {locale:'en-US',actor:'leo',key:'confidence',text:'I have designed a foolproof system. Well, except for one tiny detail.'},
 {locale:'en-US',actor:'leo',key:'uncertainty',text:'Wait... where did I put the instructions for opening the drawer?'},
] as const;
export interface VoiceAuditionReceipt {
 schemaVersion:'1.0';status:'LISTENING_REVIEW_REQUIRED';providerId:string;
 samples:Array<VoiceSample&{file:string;sha256:string;bytes:number;audio:AudioProbe}>;
}
export async function probeWav(file:string):Promise<AudioProbe>{
 const {stdout}=await execFileAsync('ffprobe',['-v','error','-show_entries','stream=codec_name,sample_rate,channels:format=duration','-of','json',file],{timeout:20_000,maxBuffer:200_000,windowsHide:true});
 const data=JSON.parse(stdout) as {streams?:Array<{codec_name?:string;sample_rate?:string;channels?:number}>;format?:{duration?:string}};
 const audio=data.streams?.[0];const duration=Number(data.format?.duration);
 if(!audio||!Number.isFinite(duration)||duration<=0)throw new Error('FFprobe could not measure TTS audio');
 return {codec:audio.codec_name??'',sampleRate:Number(audio.sample_rate),channels:Number(audio.channels),durationMs:Math.round(duration*1000)};
}
/** Produces eight actual WAV clips in a staging directory; only completed evidence becomes visible. */
export async function generateVoiceAudition(provider:VoiceProvider,root=resolve(process.cwd()),probe:ProbeAudio=probeWav):Promise<{directory:string;receipt:VoiceAuditionReceipt}>{
 if(!/^tts-http:[A-Za-z0-9._-]{2,120}$/.test(provider.providerId))throw new Error('Audition requires an identified HTTP speech provider');
 const base=join(resolve(root),'workspace','auditions');
 await mkdir(base,{recursive:true});
 const finalDir=join(base,hash(provider.providerId).slice(0,20));
 if(await stat(finalDir).then(()=>true,e=>(e as NodeJS.ErrnoException).code==='ENOENT'?false:Promise.reject(e)))
  throw new Error('Audition already exists for this provider fingerprint; review it before running again');
 const staging=await mkdtemp(join(base,'.staging-'));
 try{
  const receipt:VoiceAuditionReceipt={schemaVersion:'1.0',status:'LISTENING_REVIEW_REQUIRED',providerId:provider.providerId,samples:[]};
  for(const sample of VOICE_AUDITION_SAMPLES){
   const filename=`${sample.locale}_${sample.actor}_${sample.key}.wav`;
   const file=join(staging,filename);
   await provider.synthesize(sample.text,sample.locale,sample.actor,file);
   const bytes=await readFile(file);
   if(bytes.length<44||bytes.length>12_000_000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')
    throw new Error(`Invalid WAV returned by provider: ${filename}`);
   const audio=await probe(file);
   if(!Number.isSafeInteger(audio.durationMs)||audio.durationMs<500||audio.durationMs>30_000||
      !Number.isSafeInteger(audio.sampleRate)||audio.sampleRate<8000||audio.sampleRate>192000||
      !Number.isSafeInteger(audio.channels)||audio.channels<1||audio.channels>2||
      !['pcm_s16le','pcm_s24le','pcm_f32le'].includes(audio.codec))
    throw new Error(`Unacceptable TTS format or duration: ${filename}`);
   receipt.samples.push({...sample,file:filename,sha256:hash(bytes),bytes:bytes.length,audio});
  }
  await writeFile(join(staging,'audition.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  await rename(staging,finalDir);
  return {directory:finalDir,receipt};
 }catch(error){await rm(staging,{recursive:true,force:true});throw error;}
}