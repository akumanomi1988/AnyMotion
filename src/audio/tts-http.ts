/** Optional OpenAI-compatible WAV TTS transport, suitable for local compatible voice servers. */
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import type {CharacterId} from '../core/contracts.js';
import type {Locale} from './dubbing.js';
export type TtsTransport=(input:string|URL,init?:RequestInit)=>Promise<Response>;
export type VoiceMap=Record<Locale,Record<CharacterId,string>>;
export interface HttpTtsSettings {endpoint:string;model:string;voices:VoiceMap;apiKey?:string}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export class HttpTtsProvider{
 readonly providerId:string;
 private readonly config:HttpTtsSettings;
 constructor(config:HttpTtsSettings,private readonly transport:TtsTransport=fetch){
  const url=new URL(config.endpoint);
  if(!((url.protocol==='https:')||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))||url.username||url.password)
   throw new Error('TTS endpoint must be HTTPS or local loopback HTTP');
  if(!/^[A-Za-z0-9._-]{2,80}$/.test(config.model))throw new Error('Invalid TTS model ID');
  for(const locale of ['es-ES','en-US'] as const)for(const actor of ['vera','leo'] as const){
   if(typeof config.voices?.[locale]?.[actor]!=='string'||!/^[A-Za-z0-9._-]{2,80}$/.test(config.voices[locale][actor]))
    throw new Error(`Missing TTS voice: ${locale}/${actor}`);
  }
  this.config=config;
  this.providerId=`tts-http:${config.model}-${hash(JSON.stringify({endpoint:url.origin+url.pathname,voices:config.voices})).slice(0,12)}`;
 }
 async synthesize(text:string,locale:Locale,actor:CharacterId,file:string,speed=1):Promise<void>{
  if(!text.trim()||text.length>1000||!Number.isFinite(speed)||speed<.7||speed>1.3)throw new Error('Invalid TTS request');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),180_000);
  try{
   const headers:Record<string,string>={'Content-Type':'application/json'};
   if(this.config.apiKey)headers.Authorization=`Bearer ${this.config.apiKey}`;
   const response=await this.transport(this.config.endpoint,{method:'POST',redirect:'manual',headers,body:JSON.stringify({model:this.config.model,voice:this.config.voices[locale][actor],input:text,response_format:'wav',speed}),signal:controller.signal});
   if(response.status!==200)throw new Error(`TTS HTTP ${response.status}`);
   const body=Buffer.from(await response.arrayBuffer());
   if(body.length<44||body.length>12_000_000||body.toString('ascii',0,4)!=='RIFF'||body.toString('ascii',8,12)!=='WAVE')
    throw new Error('TTS response is not a valid bounded WAV container');
   await writeFile(file,body,{flag:'wx'});
  }finally{clearTimeout(timer);}
 }
}
export function configuredHttpTts(env:NodeJS.ProcessEnv=process.env):HttpTtsProvider|undefined{
 if(!env.ANYMOTION_TTS_ENDPOINT)return undefined;
 if(!env.ANYMOTION_TTS_MODEL||!env.ANYMOTION_TTS_VOICES)throw new Error('TTS endpoint configured without model and voice map');
 let voices:VoiceMap;
 try{voices=JSON.parse(env.ANYMOTION_TTS_VOICES) as VoiceMap;}catch{throw new Error('ANYMOTION_TTS_VOICES must be JSON');}
 return new HttpTtsProvider({endpoint:env.ANYMOTION_TTS_ENDPOINT,model:env.ANYMOTION_TTS_MODEL,apiKey:env.ANYMOTION_TTS_API_KEY,voices});
}
