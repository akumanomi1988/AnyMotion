/** Rights attestations cover exact production bytes. Evidence remains a human claim, never an automated legal opinion. */
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {validateEpisode,type Episode} from '../core/contracts.js';
import {withinRoot} from '../core/filenames.js';
import {verifiedRelease} from './approval.js';

const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const SHA=/^[a-f0-9]{64}$/;
export interface Material {assetId:string;artifact:string;sha256:string;kind:'visual'|'voice'|'music'|'sfx'}
export interface RightsClaim {assetId:string;sha256:string;rightsHolder:string;basis:'original-owned'|'licensed-commercial';evidence:string;licenseReference?:string}
export interface RightsAttestation {schemaVersion:'1.0';episodeId:string;releaseSha256:string;status:'RIGHTS_ATTESTED';reviewer:string;notes:string;confirmedAt:string;materials:Material[];claims:RightsClaim[]}
const validName=(s:unknown)=>typeof s==='string'&&s.length>=3&&s.length<=120&&!/[\u0000-\u001f]/.test(s);
const validEvidence=(s:unknown)=>typeof s==='string'&&s.trim().length>=25&&s.length<=2000&&!/[\u0000-\u0008\u000b-\u001f]/.test(s);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** Inventory is derived ONLY from release hashes, never from manually supplied filenames. */
export async function rightsInventory(input:Episode,root=resolve(process.cwd())):Promise<{episodeId:string;releaseSha256:string;materials:Material[]}>{
 const episode=validateEpisode(input),release=await verifiedRelease(episode,'final',root);
 const prefix=`productions/${episode.episodeId}/`;
 const entries:[string,'visual'|'voice'|'music'|'sfx',string][]=[
  ['picture','visual',`${prefix}final/silent.mp4`],
  ...release.manifest.locales.map(locale=>[`voice:${locale}`,'voice' as const,`${prefix}locales/${locale}/dub-manifest.json`] as [string,'voice',string]),
 ];
 if(release.manifest.artifacts[`${prefix}audio/music.wav`])entries.push(['music','music',`${prefix}audio/music.wav`]);
 if(release.manifest.artifacts[`${prefix}audio/sfx.wav`])entries.push(['sfx','sfx',`${prefix}audio/sfx.wav`]);
 const materials=entries.map(([assetId,kind,artifact])=>{
  const sha256=release.manifest.artifacts[artifact];
  if(!sha256||!SHA.test(sha256))throw new Error(`Cannot attest missing release material ${assetId}`);
  return {assetId,kind,artifact,sha256};
 });
 return {episodeId:episode.episodeId,releaseSha256:release.sha256,materials};
}
function validateClaims(input:unknown,materials:Material[]):RightsClaim[]{
 if(!Array.isArray(input)||input.length!==materials.length)throw new Error('Rights claims must cover every material exactly');
 const ids=new Set<string>();
 const claims:RightsClaim[]=[];
 for(const raw of input){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid rights claim');
  const x=raw as Record<string,unknown>;
  const keys=Object.keys(x).sort();
  if(keys.some(k=>!['assetId','sha256','rightsHolder','basis','evidence','licenseReference'].includes(k)))throw new Error('Unknown rights claim field');
  if(typeof x.assetId!=='string'||ids.has(x.assetId))throw new Error('Duplicate or invalid rights assetId');
  ids.add(x.assetId);
  const material=materials.find(m=>m.assetId===x.assetId);
  if(!material||x.sha256!==material.sha256)throw new Error(`Rights material hash changed or unknown: ${x.assetId}`);
  if(!validName(x.rightsHolder)||!validEvidence(x.evidence))throw new Error(`Missing rights holder or evidence: ${x.assetId}`);
  if(x.basis!=='original-owned'&&x.basis!=='licensed-commercial')throw new Error(`Unsupported rights basis: ${x.assetId}`);
  if(x.basis==='licensed-commercial'&&(!validEvidence(x.licenseReference)))throw new Error(`Missing commercial license reference: ${x.assetId}`);
  if(x.licenseReference!==undefined&&typeof x.licenseReference!=='string')throw new Error('Invalid license reference');
  claims.push({assetId:x.assetId,sha256:x.sha256,rightsHolder:x.rightsHolder as string,basis:x.basis,
   evidence:x.evidence as string,...(x.licenseReference?{licenseReference:x.licenseReference}:{})} as RightsClaim);
 }
 claims.sort((a,b)=>a.assetId.localeCompare(b.assetId));
 return claims;
}
/** Will not overwrite previous proof or infer ownership: a producer must provide claims. */
export async function attestRights(input:Episode,options:{reviewer:string;notes:string;claims:unknown;confirm:string},root=resolve(process.cwd())):Promise<RightsAttestation>{
 const episode=validateEpisode(input);
 if(options.confirm!==`ATTEST_RIGHTS:${episode.episodeId}`)throw new Error('Explicit rights attestation confirmation required');
 if(!validName(options.reviewer)||!validEvidence(options.notes))throw new Error('Reviewer and detailed rights notes are required');
 const inventory=await rightsInventory(episode,root);
 const claims=validateClaims(options.claims,inventory.materials);
 const data:RightsAttestation={schemaVersion:'1.0',episodeId:episode.episodeId,releaseSha256:inventory.releaseSha256,
  status:'RIGHTS_ATTESTED',reviewer:options.reviewer,notes:options.notes,confirmedAt:new Date().toISOString(),materials:inventory.materials,claims};
 const dest=withinRoot(root,join('productions',episode.episodeId,'rights-attestation.json'));
 await writeFile(dest,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
 return data;
}

export async function verifyRightsAttestation(input:Episode,root=resolve(process.cwd())):Promise<{attestation:RightsAttestation;sha256:string}>{
 const episode=validateEpisode(input);
 const dest=withinRoot(root,join('productions',episode.episodeId,'rights-attestation.json'));
 const bytes=await readFile(dest);
 const raw:unknown=JSON.parse(bytes.toString('utf8'));
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Rights attestation is invalid');
 const a=raw as RightsAttestation;
 const inventory=await rightsInventory(episode,root);
 if(!same(Object.keys(a).sort(),['schemaVersion','episodeId','releaseSha256','status','reviewer','notes','confirmedAt','materials','claims'].sort())||
    a.schemaVersion!=='1.0'||a.episodeId!==episode.episodeId||a.status!=='RIGHTS_ATTESTED'||a.releaseSha256!==inventory.releaseSha256||
    !validName(a.reviewer)||!validEvidence(a.notes)||!Number.isFinite(Date.parse(a.confirmedAt))||
    !same(a.materials,inventory.materials))throw new Error('Rights attestation missing, outdated or mismatched');
 const claims=validateClaims(a.claims,inventory.materials);
 if(!same(a.claims,claims))throw new Error('Rights claims are not canonical or changed');
 return {attestation:a,sha256:hash(bytes)};
}
