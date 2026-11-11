/** A release requires a human decision bound to immutable, verified bytes. */
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve} from 'node:path';
import {withinRoot} from '../core/filenames.js';
import type {Episode} from '../core/contracts.js';
import {validateEpisode} from '../core/contracts.js';
import type {ReleaseManifest} from '../production/package.js';

export interface EditorialDecision {
  schemaVersion:'1.0'; episodeId:string; preset:'final'; releaseSha256:string;
  status:'EDITORIAL_APPROVED'; reviewer:string; reviewNotes:string; approvedAt:string;
  commercialRightsConfirmed:true; diagnosticVoicesAllowed:false;
}
export interface ApprovalInput {reviewer:string;reviewNotes:string;confirm:string;commercialRightsConfirmed:boolean}
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
async function shaFile(file:string):Promise<string>{const digest=createHash('sha256');for await(const block of createReadStream(file))digest.update(block);return digest.digest('hex');}
const loaded=(x:unknown):x is ReleaseManifest=>!!x&&typeof x==='object'&&!Array.isArray(x)&&
  (x as ReleaseManifest).schemaVersion==='1.0'&&(x as ReleaseManifest).status==='TECHNICAL_PASS_EDITORIAL_PENDING';

/** Verify hashes on disk, not just a manifest or a successful CLI exit code. */
export async function verifiedRelease(episodeInput:Episode,preset:'preview'|'final',root=resolve(process.cwd())):Promise<{manifest:ReleaseManifest;sha256:string}> {
  const episode=validateEpisode(episodeInput);
  const file=withinRoot(root,join('productions',episode.episodeId,`release_${preset}.json`));
  const bytes=await readFile(file);
  const manifest:unknown=JSON.parse(bytes.toString('utf8'));
  if(!loaded(manifest)||manifest.episodeId!==episode.episodeId||manifest.preset!==preset||manifest.publicationAllowed!==false)
    throw new Error('Release identity or technical status mismatch');
  const required=[`productions/${episode.episodeId}/timeline.json`,
    `productions/${episode.episodeId}/${preset}/manifest.json`,
    `productions/${episode.episodeId}/${preset}/quality-report.json`,
    `productions/${episode.episodeId}/${preset}/silent.mp4`];
  for(const locale of manifest.locales) {
    if(locale!=='es-ES'&&locale!=='en-US')throw new Error(`Unsupported release locale: ${locale}`);
    for(const rel of ['dub-manifest.json',`mux_${preset}.json`,`final_${preset}.mp4`,
      'speech-fit-report.json','vera.srt','leo.srt','combined.srt'])
      required.push(`productions/${episode.episodeId}/locales/${locale}/${rel}`);
  }
  if(manifest.locales.length<1||manifest.locales.length!==new Set(manifest.locales).size || required.some(rel=>!manifest.artifacts[rel]))
    throw new Error('Incomplete release: required media/voice/QA evidence missing');
  for(const [rel,checksum] of Object.entries(manifest.artifacts)){
    if(!/^productions\/[a-zA-Z0-9_-]+\//.test(rel)||!rel.startsWith(`productions/${episode.episodeId}/`)||!/^[a-f0-9]{64}$/.test(checksum))
      throw new Error(`Unsafe release artifact: ${rel}`);
    if(await shaFile(withinRoot(root,rel))!==checksum)throw new Error(`Release artifact changed: ${rel}`);
  }
  if(Object.keys(manifest.artifacts).length<5)throw new Error('Incomplete release manifest');
  return {manifest,sha256:sha(bytes)};
}

const diagnostic=/diagnostic|espeak|synthetic|fixture|test[-_ ]?tone/i;
function assertApprovedVoice(provider:string|undefined,locale:string):void {
  if(!provider||!provider.startsWith('tts-http:')||diagnostic.test(provider)) throw new Error(`Locale ${locale} uses an unapproved diagnostic voice`);
  // The operator must explicitly allow commercial voice IDs, including third-party licenses.
  const allowed=(process.env.ANYMOTION_APPROVED_VOICE_PROVIDERS??'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!allowed.includes(provider))throw new Error(`Voice provider ${provider} for ${locale} is not commercially allowlisted`);
}
/** Diagnostic speech and preview outputs are never approved for public release. */
export async function approveEditorial(episode:Episode,input:ApprovalInput,root=resolve(process.cwd())):Promise<EditorialDecision>{
  const ep=validateEpisode(episode);
  if(input.confirm!==`APPROVE:${ep.episodeId}`)throw new Error('Explicit approval phrase required');
  if(!input.commercialRightsConfirmed)throw new Error('Rights provenance must be confirmed');
  if(!/^[\p{L}\p{N} ._'-]{3,80}$/u.test(input.reviewer))throw new Error('Invalid reviewer');
  if(input.reviewNotes.trim().length<30||input.reviewNotes.length>4000)throw new Error('Review notes require 30–4000 characters');
  const release=await verifiedRelease(ep,'final',root);
  for(const locale of release.manifest.locales){
    const file=withinRoot(root,join('productions',ep.episodeId,'locales',locale,'dub-manifest.json'));
    const voice=JSON.parse(await readFile(file,'utf8')) as {provider?:string;status?:string};
    if(voice.status!=='LOCALIZED')throw new Error(`Locale ${locale} missing validated speech`);
    assertApprovedVoice(voice.provider,locale);
  }
  const decision:EditorialDecision={schemaVersion:'1.0',episodeId:ep.episodeId,preset:'final',releaseSha256:release.sha256,
    status:'EDITORIAL_APPROVED',reviewer:input.reviewer.trim(),reviewNotes:input.reviewNotes.trim(),approvedAt:new Date().toISOString(),
    commercialRightsConfirmed:true,diagnosticVoicesAllowed:false};
  const file=withinRoot(root,join('productions',ep.episodeId,'editorial-approval.json'));
  await writeFile(file,JSON.stringify(decision,null,2)+'\n',{flag:'wx'});
  return decision;
}

export async function verifyEditorialApproval(episode:Episode,root=resolve(process.cwd())):Promise<EditorialDecision>{
  const ep=validateEpisode(episode);
  const approvalFile=withinRoot(root,join('productions',ep.episodeId,'editorial-approval.json'));
  const decision=JSON.parse(await readFile(approvalFile,'utf8')) as EditorialDecision;
  const release=await verifiedRelease(ep,'final',root);
  if(decision.status!=='EDITORIAL_APPROVED'||decision.preset!=='final'||decision.episodeId!==ep.episodeId||
    decision.releaseSha256!==release.sha256||decision.commercialRightsConfirmed!==true||decision.diagnosticVoicesAllowed!==false)
    throw new Error('Editorial approval is invalid or stale');
  for(const locale of release.manifest.locales){
    const voice=JSON.parse(await readFile(withinRoot(root,join('productions',ep.episodeId,'locales',locale,'dub-manifest.json')),'utf8')) as {provider?:string};
    assertApprovedVoice(voice.provider,locale);
  }
  return decision;
}
