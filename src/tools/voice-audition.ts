#!/usr/bin/env node
/** Paid TTS calls require explicit operator confirmation. No editorial approval is granted. */
import {configuredHttpTts} from '../audio/tts-http.js';
import {generateVoiceAudition} from '../quality/voice-audition.js';

async function main():Promise<void>{
 if(process.argv.length!==4||process.argv[2]!=='--confirm'||process.argv[3]!=='I_ACCEPT_TTS_COSTS')
  throw new Error('Usage: npm run audition:voices -- --confirm I_ACCEPT_TTS_COSTS');
 const provider=configuredHttpTts();
 if(!provider)throw new Error('Configure ANYMOTION_TTS_ENDPOINT, ANYMOTION_TTS_MODEL and ANYMOTION_TTS_VOICES first');
 const result=await generateVoiceAudition(provider);
 console.log(JSON.stringify({status:result.receipt.status,directory:result.directory,provider:result.receipt.providerId,sampleCount:result.receipt.samples.length},null,2));
 console.log('Listen to every clip and document character consistency, pronunciation and commercial rights before approving any production.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
