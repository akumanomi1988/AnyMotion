#!/usr/bin/env node
/** Explicit paid-provider audit. Never creates content, publishes, or approves a release. */
import {OpenAICompatibleStoryProvider} from '../story/llm.js';
import {auditLlmProvider} from '../quality/llm-provider-audit.js';

async function main():Promise<void>{
 if(process.argv.length!==4||process.argv[2]!=='--confirm'||process.argv[3]!=='I_ACCEPT_LLM_COSTS')
  throw new Error('Usage: npm run audit:llm -- --confirm I_ACCEPT_LLM_COSTS');
 const {ANYMOTION_LLM_ENDPOINT:endpoint,ANYMOTION_LLM_MODEL:model,ANYMOTION_LLM_API_KEY:apiKey}=process.env;
 if(!endpoint||!model||!apiKey)throw new Error('Configure ANYMOTION_LLM_ENDPOINT, ANYMOTION_LLM_MODEL and ANYMOTION_LLM_API_KEY');
 const provider=new OpenAICompatibleStoryProvider({endpoint,model,apiKey});
 const result=await auditLlmProvider(provider,endpoint);
 console.log(JSON.stringify({status:result.receipt.status,directory:result.directory,model:provider.modelId,requestsUsed:result.receipt.requestsUsed},null,2));
 console.log('JSON protocol verified only. Run real staged episode generation and human editorial review before any commercial claim.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
