/** A single bounded real-provider protocol probe. Evidence is never editorial approval. */
import {createHash, randomBytes} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rename, rm, stat, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import type {StructuredStoryProvider} from '../story/llm.js';

const digest=(data:string)=>createHash('sha256').update(data).digest('hex');
const exists=(file:string)=>stat(file).then(()=>true,(error:NodeJS.ErrnoException)=>error.code==='ENOENT'?false:Promise.reject(error));
const expectedFields=['challenge','language','protocolVersion','supportsStructuredJson'];
const SYSTEM_PROMPT='Respond with exactly one JSON object, without Markdown or additional fields. Use the exact keys and values from the user payload. Never include API keys or executable code.';

export interface LlmProviderEvidence {
 schemaVersion:'1.0';status:'JSON_PROTOCOL_VERIFIED_EDITORIAL_PENDING';
 providerModel:string;providerEndpointHash:string;
 requestSha256:string;responseSha256:string;
 response:{protocolVersion:'1.0';challenge:string;language:'es-ES';supportsStructuredJson:true};
 requestsUsed:1;maxOutputTokens:160;
}

/** Throws on any unsupported output. Does not trust a successful HTTP status by itself. */
export function verifyLlmProbeResponse(value:unknown,challenge:string):LlmProviderEvidence['response']{
 if(!value||Array.isArray(value)||typeof value!=='object')throw new Error('LLM probe must return a JSON object');
 const o=value as Record<string,unknown>;
 if(Object.keys(o).sort().join('|')!==expectedFields.join('|'))throw new Error('LLM probe returned unexpected JSON fields');
 if(o.protocolVersion!=='1.0'||o.challenge!==challenge||o.language!=='es-ES'||o.supportsStructuredJson!==true)
  throw new Error('LLM probe failed strict structured-output challenge');
 return o as unknown as LlmProviderEvidence['response'];
}

/**
 * Exactly one bounded model call; records enough to prove JSON protocol but never stores credentials.
 * Uses a private staging directory and refuses to overwrite prior evidence for this endpoint/model.
 */
export async function auditLlmProvider(
 provider:StructuredStoryProvider,
 endpoint:string,
 root=resolve(process.cwd()),
 makeChallenge:()=>string=()=>randomBytes(16).toString('hex'),
):Promise<{directory:string;receipt:LlmProviderEvidence}>{
 if(typeof provider.modelId!=='string'||provider.modelId.length<2||provider.modelId.length>160)throw new Error('Invalid LLM model identity');
 const u=new URL(endpoint);
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))
  throw new Error('LLM probe endpoint must use HTTPS or local loopback');
 if(u.username||u.password||u.hash)throw new Error('Do not place secrets or fragments in LLM endpoint URLs');
 const modelId=provider.modelId;
 const endpointHash=digest(u.toString());
 const fingerprint=digest(`${modelId}\n${endpointHash}`).slice(0,24);
 const base=join(resolve(root),'workspace','llm-probes');
 await mkdir(base,{recursive:true});
 const directory=join(base,fingerprint);
 if(await exists(directory))throw new Error('LLM provider evidence already exists; inspect before requesting another paid probe');
 const challenge=makeChallenge();
 if(!/^[a-f0-9]{32}$/.test(challenge))throw new Error('Invalid LLM challenge');
 const system=SYSTEM_PROMPT;
 const payload={protocolVersion:'1.0',challenge,language:'es-ES',supportsStructuredJson:true};
 const prompt=JSON.stringify(payload);
 const stage=await mkdtemp(join(base,'.probe-'));
 try{
  const raw=await provider.generateJson(system,prompt,160);
  const parsed=verifyLlmProbeResponse(raw,challenge);
  const receipt:LlmProviderEvidence={
   schemaVersion:'1.0',status:'JSON_PROTOCOL_VERIFIED_EDITORIAL_PENDING',
   providerModel:modelId,providerEndpointHash:endpointHash,
   requestSha256:digest(`${system}\n${prompt}`),responseSha256:digest(JSON.stringify(parsed)),
   response:parsed,requestsUsed:1,maxOutputTokens:160,
  };
  await writeFile(join(stage,'provider-audit.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  await rename(stage,directory);
  return {directory,receipt};
 }catch(error){await rm(stage,{recursive:true,force:true});throw error;}
}

/** Re-check stored evidence without making any provider request. */
export async function verifyStoredLlmAudit(directory:string):Promise<LlmProviderEvidence>{
 const receipt=JSON.parse(await readFile(join(resolve(directory),'provider-audit.json'),'utf8')) as LlmProviderEvidence;
 const fingerprint=digest(`${receipt.providerModel}\n${receipt.providerEndpointHash}`).slice(0,24);
 const request=JSON.stringify({protocolVersion:'1.0',challenge:receipt.response.challenge,language:'es-ES',supportsStructuredJson:true});
 if(receipt.schemaVersion!=='1.0'||receipt.status!=='JSON_PROTOCOL_VERIFIED_EDITORIAL_PENDING'||
    receipt.requestsUsed!==1||receipt.maxOutputTokens!==160||!/^([a-f0-9]{64})$/.test(receipt.providerEndpointHash)||
    !/^([a-f0-9]{64})$/.test(receipt.requestSha256)||receipt.responseSha256!==digest(JSON.stringify(receipt.response))||
    receipt.requestSha256!==digest(`${SYSTEM_PROMPT}\n${request}`)||resolve(directory).split(/[/\\]/).pop()!==fingerprint)
  throw new Error('Stored LLM audit evidence is invalid');
 verifyLlmProbeResponse(receipt.response,receipt.response.challenge);
 return receipt;
}
