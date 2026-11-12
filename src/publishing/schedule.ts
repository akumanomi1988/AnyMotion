/** Guarded future publication via official videos.update, never automatic. */
import {createHash} from 'node:crypto';
import {open,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {withinRoot} from '../core/filenames.js';
import {validateEpisode,type Episode} from '../core/contracts.js';
import {verifyEditorialApproval,verifiedRelease} from './approval.js';
import {validateVideoMetadata,type VideoMetadata,type UploadResult,type Transport} from './youtube.js';
import type {ThumbnailManifest} from '../production/thumbnail.js';

export interface ScheduleReceipt {
 schemaVersion:'1.0';episodeId:string;videoId:string;status:'SCHEDULED';
 publishAt:string;releaseHash:string;metadataHash:string;thumbnailHash:string;verifiedAt:string;
}
const sha=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{8,32}$/.test(value);
export function validatePublishAt(value:string,now=new Date()):string {
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value))throw new Error('UTC publishAt must match YYYY-MM-DDTHH:mm:ssZ');
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString()!==value.replace('Z','.000Z'))throw new Error('Invalid UTC publishAt date');
 const delta=parsed.getTime()-now.getTime();
 if(delta<60*60_000||delta>365*24*60*60_000)throw new Error('Schedule must be 1 hour to 365 days in the future');
 return value;
}
interface RemoteVideo{id?:string;status?:{privacyStatus?:string;publishAt?:string;uploadStatus?:string}}
async function remoteState(videoId:string,token:string,transport:Transport):Promise<RemoteVideo> {
 const response=await transport(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(videoId)}`,{
  method:'GET',redirect:'manual',headers:{Authorization:`Bearer ${token}`}});
 if(response.status!==200)throw new Error(`YouTube remote state HTTP ${response.status}`);
 const data=await response.json() as {items?:RemoteVideo[]};
 if(!Array.isArray(data.items)||data.items.length!==1||data.items[0]?.id!==videoId||data.items[0]?.status?.privacyStatus!=='private')throw new Error('YouTube video is not verified private');
 if(['failed','rejected'].includes(data.items[0].status?.uploadStatus??''))throw new Error('YouTube rejected processing');
 return data.items[0];
}
export async function scheduleApprovedVideo(input:{episode:Episode;metadata:VideoMetadata;publishAt:string;accessToken:string;confirm:string;root?:string;transport?:Transport;now?:Date}):Promise<ScheduleReceipt>{
 const ep=validateEpisode(input.episode),publishAt=validatePublishAt(input.publishAt,input.now??new Date());
 if(input.confirm!==`SCHEDULE:${ep.episodeId}:${publishAt}`)throw new Error('Exact operator schedule confirmation required');
 if(!input.accessToken.trim()||input.accessToken.length>8192)throw new Error('Missing OAuth token');
 const metadata=validateVideoMetadata(input.metadata), metadataHash=sha(JSON.stringify(metadata));
 const root=resolve(input.root??process.cwd()),transport=input.transport??fetch;
 await verifyEditorialApproval(ep,root);
 const release=await verifiedRelease(ep,'final',root);
 const dir=withinRoot(root,join('productions',ep.episodeId));
 const receipt=JSON.parse(await readFile(join(dir,'publication','youtube-private.json'),'utf8')) as UploadResult;
 if(receipt.status!=='PRIVATE_UPLOADED'||receipt.privacyStatus!=='private'||!validId(receipt.videoId)||receipt.metadataSha256!==metadataHash)throw new Error('Missing or stale private upload receipt');
 if(receipt.sourceSha256!==sha(await readFile(join(dir,'locales',ep.sourceLocale,'final_final.mp4'))))throw new Error('Uploaded source video changed');
 const thumb=JSON.parse(await readFile(join(dir,'thumbnails','thumbnail.json'),'utf8')) as ThumbnailManifest;
 const thumbnailHash=sha(await readFile(join(dir,'thumbnails','thumbnail.png')));
 if(thumb.status!=='THUMBNAIL_READY'||thumb.episodeId!==ep.episodeId||thumb.imageHash!==thumbnailHash||thumb.sourceHash!==sha(JSON.stringify(ep)))throw new Error('Thumbnail not verified');
 const thumbnailReceipt=JSON.parse(await readFile(join(dir,'publication','youtube-thumbnail.json'),'utf8')) as {status?:string;imageHash?:string;videoId?:string};
 if(thumbnailReceipt.status!=='THUMBNAIL_UPLOADED'||thumbnailReceipt.videoId!==receipt.videoId||thumbnailReceipt.imageHash!==thumbnailHash)throw new Error('Thumbnail upload not verified');
 const output=join(dir,'publication','youtube-schedule.json');
 const remote=await remoteState(receipt.videoId,input.accessToken,transport);
 let previous:ScheduleReceipt|null=null;
 try{previous=JSON.parse(await readFile(output,'utf8')) as ScheduleReceipt;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(previous){
  if(previous.status!=='SCHEDULED'||previous.episodeId!==ep.episodeId||previous.videoId!==receipt.videoId||previous.publishAt!==publishAt||previous.releaseHash!==release.sha256||previous.metadataHash!==metadataHash||previous.thumbnailHash!==thumbnailHash||remote.status?.publishAt!==publishAt)throw new Error('Schedule differs from approved/remote state');
  return previous;
 }
 if(remote.status?.publishAt && remote.status.publishAt!==publishAt)throw new Error('YouTube already scheduled this video for a different date');
 if(!remote.status?.publishAt){
  const lockPath=join(dir,'publication','youtube-schedule.lock');
  const lock=await open(lockPath,'wx').catch(()=>{throw new Error('Concurrent schedule update');});
  try{
   // videos.update replaces the status part. Always specify private and audience classification.
   const body={id:receipt.videoId,status:{privacyStatus:'private',publishAt,selfDeclaredMadeForKids:metadata.madeForKids}};
   const response=await transport('https://www.googleapis.com/youtube/v3/videos?part=status',{method:'PUT',redirect:'manual',headers:{Authorization:`Bearer ${input.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(response.status!==200)throw new Error(`Scheduling rejected by YouTube HTTP ${response.status}`);
   const updated=await response.json() as RemoteVideo;
   if(updated.id!==receipt.videoId||updated.status?.privacyStatus!=='private'||updated.status.publishAt!==publishAt)throw new Error('YouTube did not acknowledge exact private schedule');
  }finally{await lock.close();await rm(lockPath,{force:true});}
 }
 const verified=await remoteState(receipt.videoId,input.accessToken,transport);
 if(verified.status?.publishAt!==publishAt)throw new Error('Remote schedule verification failed');
 const result:ScheduleReceipt={schemaVersion:'1.0',episodeId:ep.episodeId,videoId:receipt.videoId,status:'SCHEDULED',publishAt,releaseHash:release.sha256,metadataHash,thumbnailHash,verifiedAt:new Date().toISOString()};
 await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
