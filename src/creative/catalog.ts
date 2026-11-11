/** Persistent series memory. No inter-episode plot continuity and no claim that lexical overlap proves plagiarism. */
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {validateEpisode,type Episode} from '../core/contracts.js';
import {validateStoryBrief,type StoryBrief} from '../story/llm.js';
import {verifyEditorialApproval} from '../publishing/approval.js';

export interface CreativeFingerprint {
 schemaVersion:'1.0'; episodeId:string; premise:string; summary:string;
 conflictType:string|null; escalationPattern:string|null; mainProp:string|null;
 resolutionType:string|null; dominantCharacter:'vera'|'leo'|'both'|null; tags:string[];
}
export interface CatalogEntry {
 fingerprint:CreativeFingerprint; episodeHash:string; status:'DRAFT'|'EDITORIAL_APPROVED';
 approvalReleaseHash:string|null; createdAt:string;
}
export interface SimilarityEvidence {
 episodeId:string; status:CatalogEntry['status']; score:number;
 sharedTerms:string[]; matchingDimensions:string[];
}
export interface CatalogAssessment {
 status:'EDITORIAL_REVIEW_REQUIRED'; repeatedPremiseRisk:boolean;
 matches:SimilarityEvidence[]; scannedEntries:number;
}
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const isObj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const idPattern=/^[A-Za-z][A-Za-z0-9_-]{1,63}$/;
function bounded(value:unknown,what:string,min:number,max:number):asserts value is string{
 if(typeof value!=='string'||value.trim().length<min||value.length>max||/[\u0000-\u001f<>]/.test(value))throw new Error(`Invalid creative ${what}`);
}
function smallTag(value:string):boolean{return /^[\p{L}\p{N}][\p{L}\p{N}_ -]{1,39}$/u.test(value);}
export function validateCreativeFingerprint(raw:unknown):CreativeFingerprint {
 if(!isObj(raw)||Object.keys(raw).sort().join(',')!==['schemaVersion','episodeId','premise','summary','conflictType','escalationPattern','mainProp','resolutionType','dominantCharacter','tags'].sort().join(','))
  throw new Error('Creative fingerprint has unknown or missing fields');
 if(raw.schemaVersion!=='1.0'||typeof raw.episodeId!=='string'||!idPattern.test(raw.episodeId))throw new Error('Invalid creative episode ID');
 bounded(raw.premise,'premise',12,800);bounded(raw.summary,'summary',12,400);
 for(const field of ['conflictType','escalationPattern','mainProp','resolutionType'] as const){
  if(raw[field]!==null)bounded(raw[field],field,3,100);
 }
 if(raw.dominantCharacter!==null&&!['vera','leo','both'].includes(String(raw.dominantCharacter)))throw new Error('Unknown dominant character');
 if(!Array.isArray(raw.tags)||raw.tags.length>12||raw.tags.some(t=>typeof t!=='string'||!smallTag(t)))throw new Error('Invalid creative tags');
 if(new Set(raw.tags.map((t:string)=>t.toLowerCase())).size!==raw.tags.length)throw new Error('Duplicate creative tags');
 return raw as unknown as CreativeFingerprint;
}

/** Conservative tokenization for Spanish, without external services or semantic-model guesses. */
function terms(input:string):Set<string>{
 const stop=new Set(['para','como','pero','cuando','donde','entre','hasta','sobre','desde','tras','ante','cada','esto','esta','estos','estas','ellos','ellas','porque','tiene','tener','tambien','ahora','solo','todo','todos','todas','unos','unas','otro','otra','otras','otros','ante','bajo','acaba','hacer','algo','quiere','puede']);
 return new Set(input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(t=>t.length>=4&&!stop.has(t)));
}
function related(a:CreativeFingerprint,b:CreativeFingerprint):{score:number;sharedTerms:string[];matchingDimensions:string[]}{
 const first=terms(a.premise+' '+a.summary),second=terms(b.premise+' '+b.summary);
 const common=[...first].filter(t=>second.has(t)).sort();
 // Containment catches almost identical rephrasings; Jaccard avoids short summaries dominating longer ones.
 const containment=common.length/Math.max(1,Math.min(first.size,second.size));
 const jaccard=common.length/Math.max(1,first.size+second.size-common.length);
 const dims=(['conflictType','escalationPattern','mainProp','resolutionType','dominantCharacter'] as const)
  .filter(k=>a[k]!==null&&b[k]!==null&&String(a[k]).toLowerCase()===String(b[k]).toLowerCase());
 const tagsA=new Set(a.tags.map(t=>t.toLowerCase())),tagsB=new Set(b.tags.map(t=>t.toLowerCase()));
 const tagOverlap=[...tagsA].filter(t=>tagsB.has(t)).length/Math.max(1,Math.min(tagsA.size,tagsB.size));
 const textScore=.65*containment+.35*jaccard;
 const structure=dims.length/5;
 const parts=(dims.length>0||tagsA.size&&tagsB.size)?(.65*textScore+.25*structure+.1*tagOverlap):textScore;
 return {score:Math.round(Math.min(1,parts)*100)/100,sharedTerms:common.slice(0,20),matchingDimensions:[...dims]};
}

export class CreativeCatalog {
 readonly db:DatabaseSync;
 constructor(filename:string){
  if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
  this.db=new DatabaseSync(filename);
  this.db.exec(`PRAGMA busy_timeout=5000;PRAGMA journal_mode=WAL;
   CREATE TABLE IF NOT EXISTS creative_catalog (
    episode_id TEXT PRIMARY KEY,episode_hash TEXT NOT NULL, fingerprint_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN('DRAFT','EDITORIAL_APPROVED')),
    approval_release_hash TEXT,created_at TEXT NOT NULL
   );CREATE INDEX IF NOT EXISTS creative_status ON creative_catalog(status,created_at);`);
 }
 close():void{this.db.close();}
 get(episodeId:string):CatalogEntry|null{
  if(!idPattern.test(episodeId))throw new Error('Invalid episode ID');
  const row=this.db.prepare('SELECT * FROM creative_catalog WHERE episode_id=?').get(episodeId) as Record<string,unknown>|undefined;
  if(!row)return null;
  return {fingerprint:validateCreativeFingerprint(JSON.parse(String(row.fingerprint_json)) as unknown),
   episodeHash:String(row.episode_hash),status:row.status as CatalogEntry['status'],
   approvalReleaseHash:row.approval_release_hash===null?null:String(row.approval_release_hash),createdAt:String(row.created_at)};
 }
 list(excludeEpisodeId?:string,limit=300):CatalogEntry[]{
  if(excludeEpisodeId!==undefined&&!idPattern.test(excludeEpisodeId))throw new Error('Invalid excluded episode ID');
  if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error('Invalid catalog limit');
  const ids=this.db.prepare('SELECT episode_id FROM creative_catalog WHERE episode_id!=? ORDER BY created_at DESC, episode_id DESC LIMIT ?')
   .all(excludeEpisodeId??'',limit) as {episode_id:string}[];
  return ids.map(row=>this.get(row.episode_id)!);
 }
 /** Immutable draft registry: never replace a previous story under the same episode ID. */
 registerDraft(episodeInput:Episode,fingerprintInput:CreativeFingerprint):CatalogEntry{
  const episode=validateEpisode(episodeInput),fingerprint=validateCreativeFingerprint(fingerprintInput);
  if(episode.episodeId!==fingerprint.episodeId)throw new Error('Fingerprint and episode IDs differ');
  const episodeHash=sha(JSON.stringify(episode));
  const previous=this.get(episode.episodeId);
  if(previous){
   if(previous.episodeHash!==episodeHash||JSON.stringify(previous.fingerprint)!==JSON.stringify(fingerprint))
    throw new Error('Creative history is immutable; a changed script requires a new episode revision');
   return previous;
  }
  const createdAt=new Date().toISOString();
  this.db.prepare('INSERT INTO creative_catalog(episode_id,episode_hash,fingerprint_json,status,approval_release_hash,created_at) VALUES(?,?,?,\'DRAFT\',NULL,?)')
   .run(episode.episodeId,episodeHash,JSON.stringify(fingerprint),createdAt);
  return this.get(episode.episodeId)!;
 }
 /** Approval is not a Boolean from an agent; it is checked against signed-off release bytes on disk. */
 async confirmEditorialApproval(episodeInput:Episode,root:string):Promise<CatalogEntry>{
  const episode=validateEpisode(episodeInput);
  const previous=this.get(episode.episodeId);
  if(!previous||previous.episodeHash!==sha(JSON.stringify(episode)))throw new Error('Only an immutable indexed draft may be approved');
  const signed=await verifyEditorialApproval(episode,root);
  if(previous.status==='EDITORIAL_APPROVED'){
   if(previous.approvalReleaseHash!==signed.releaseSha256)throw new Error('Already indexed approval has a different release hash');
   return previous;
  }
  this.db.prepare("UPDATE creative_catalog SET status='EDITORIAL_APPROVED',approval_release_hash=? WHERE episode_id=? AND status='DRAFT'")
   .run(signed.releaseSha256,episode.episodeId);
  return this.get(episode.episodeId)!;
 }
 assess(fingerprintInput:CreativeFingerprint,limit=10):CatalogAssessment {
  const current=validateCreativeFingerprint(fingerprintInput);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Invalid comparison limit');
  const all=this.list(current.episodeId,1000);
  const matches=all.map(entry=>({episodeId:entry.fingerprint.episodeId,status:entry.status,
   ...related(current,entry.fingerprint)})).filter(item=>item.score>=.35)
   .sort((a,b)=>b.score-a.score||a.episodeId.localeCompare(b.episodeId)).slice(0,limit);
  return {status:'EDITORIAL_REVIEW_REQUIRED',repeatedPremiseRisk:matches.some(m=>m.score>=.75),matches,scannedEntries:all.length};
 }
 /** This is an input snapshot, not a semantic proof of novelty. Reuse it for replays. */
 contextualizeBrief(input:StoryBrief):StoryBrief{
  const brief=validateStoryBrief(input);
  const relevant=this.list(brief.episodeId,30).map(entry=>entry.fingerprint.premise+' — '+entry.fingerprint.summary);
  const prior=Array.from(new Set([...brief.priorSummaries,...relevant])).slice(0,30).map(s=>s.slice(0,400));
  return validateStoryBrief({...brief,priorSummaries:prior});
 }
}
/** The LLM may not fabricate conflict fingerprints. Unknown fields remain null until editorial review. */
export function draftFingerprint(brief:StoryBrief,episode:Episode):CreativeFingerprint{
 const validated=validateStoryBrief(brief),ep=validateEpisode(episode);
 if(validated.episodeId!==ep.episodeId)throw new Error('Draft brief and episode differ');
 return validateCreativeFingerprint({schemaVersion:'1.0',episodeId:ep.episodeId,premise:validated.premise,
  summary:(ep.title+' — '+validated.premise).slice(0,400),conflictType:null,escalationPattern:null,
  mainProp:null,resolutionType:null,dominantCharacter:null,tags:[]});
}

/** Compare a proposed premise before spending LLM tokens (unknown structure is deliberately null). */
export function premiseFingerprint(briefInput:unknown):CreativeFingerprint {
 const brief=validateStoryBrief(briefInput);
 return validateCreativeFingerprint({schemaVersion:'1.0',episodeId:brief.episodeId,premise:brief.premise,summary:brief.premise.slice(0,400),
  conflictType:null,escalationPattern:null,mainProp:null,resolutionType:null,dominantCharacter:null,tags:[]});
}
