/** Guarded upload of an original, validated thumbnail using YouTube Data API v3 thumbnails.set. */
import {createHash} from 'node:crypto';
import {open,readFile,writeFile,rm,stat,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {withinRoot} from '../core/filenames.js';
import {validateEpisode,type Episode} from '../core/contracts.js';
import {verifyEditorialApproval} from './approval.js';
import type {ThumbnailManifest} from '../production/thumbnail.js';
import type {Transport,UploadResult} from './youtube.js';

interface ThumbnailReceipt {
 schemaVersion:'1.0';status:'THUMBNAIL_UPLOADED';episodeId:string;videoId:string;
 imageHash:string;sourceHash:string;uploadedAt:string;
}
const digest=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const isId=(s:unknown):s is string=>typeof s==='string'&&/^[A-Za-z0-9_-]{8,32}$/.test(s);
const exists=(path:string)=>stat(path).then(()=>true,(e:NodeJS.ErrnoException)=>e.code==='ENOENT'?false:Promise.reject(e));

async function assertPrivate(id:string,accessToken:string,transport:Transport):Promise<void>{
 const url=`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(id)}`;
 const response=await transport(url,{method:'GET',redirect:'manual',headers:{Authorization:`Bearer ${accessToken}`}});
 if(response.status!==200)throw new Error(`Cannot verify private video: HTTP ${response.status}`);
 const result=await response.json() as {items?:Array<{id?:string;status?:{privacyStatus?:string}}>};
 if(!Array.isArray(result.items)||result.items.length!==1||result.items[0]?.id!==id||result.items[0]?.status?.privacyStatus!=='private')
  throw new Error('Thumbnail upload requires an existing verified private video');
}

/** This does not publish a video or change its privacy status. Requires independent explicit confirmation. */
export async function uploadApprovedThumbnail(input:{episode:Episode;accessToken:string;confirm:string;root?:string;transport?:Transport}):Promise<ThumbnailReceipt>{
 const ep=validateEpisode(input.episode);
 if(input.confirm!==`UPLOAD_THUMBNAIL:${ep.episodeId}`)throw new Error('Explicit thumbnail confirmation required');
 if(!input.accessToken.trim()||input.accessToken.length>8192)throw new Error('Missing OAuth access token');
 const root=resolve(input.root??process.cwd()),transport=input.transport??fetch;
 await verifyEditorialApproval(ep,root);
 const base=withinRoot(root,join('productions',ep.episodeId));
 const publication=withinRoot(base,'publication');
 const privateReceipt=JSON.parse(await readFile(join(publication,'youtube-private.json'),'utf8')) as UploadResult;
 if(!isId(privateReceipt.videoId)||privateReceipt.status!=='PRIVATE_UPLOADED'||privateReceipt.privacyStatus!=='private')
  throw new Error('YouTube private upload receipt missing or invalid');
 const assetDir=withinRoot(base,'thumbnails');
 const thumbnailRecord=JSON.parse(await readFile(join(assetDir,'thumbnail.json'),'utf8')) as ThumbnailManifest;
 const png=await readFile(join(assetDir,'thumbnail.png'));
 if(thumbnailRecord.schemaVersion!=='1.0'||thumbnailRecord.status!=='THUMBNAIL_READY'||thumbnailRecord.episodeId!==ep.episodeId||
   thumbnailRecord.sourceHash!==digest(JSON.stringify(ep))||thumbnailRecord.imageHash!==digest(png)||
   thumbnailRecord.width!==1280||thumbnailRecord.height!==720||png.length>50*1024*1024||png.length<128||
   png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.readUInt32BE(16)!==1280||png.readUInt32BE(20)!==720)
  throw new Error('Thumbnail is missing, unsafe or changed after validation');
 const receiptFile=join(publication,'youtube-thumbnail.json');
 if(await exists(receiptFile)){
  const saved=JSON.parse(await readFile(receiptFile,'utf8')) as ThumbnailReceipt;
  if(saved.status!=='THUMBNAIL_UPLOADED'||saved.videoId!==privateReceipt.videoId||saved.imageHash!==thumbnailRecord.imageHash||saved.sourceHash!==thumbnailRecord.sourceHash)
   throw new Error('Existing YouTube thumbnail receipt is for a different revision');
  await assertPrivate(saved.videoId,input.accessToken,transport);
  return saved;
 }
 await assertPrivate(privateReceipt.videoId,input.accessToken,transport);
 await mkdir(publication,{recursive:true});
 const lockFile=join(publication,'youtube-thumbnail.lock');
 const handle=await open(lockFile,'wx').catch(()=>{throw new Error('Thumbnail upload already in progress');});
 try{
  if(await exists(receiptFile))throw new Error('Thumbnail receipt was created by another upload');
  const url=`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(privateReceipt.videoId)}&uploadType=media`;
  const response=await transport(url,{method:'POST',redirect:'manual',headers:{Authorization:`Bearer ${input.accessToken}`,'Content-Type':'image/png','Content-Length':String(png.length)},body:png});
  if(response.status!==200)throw new Error(`YouTube thumbnail API HTTP ${response.status}`);
  const body=await response.json() as {kind?:string;items?:unknown[]};
  if(body.kind!=='youtube#thumbnailSetResponse'||!Array.isArray(body.items)||body.items.length===0)
   throw new Error('YouTube did not confirm the thumbnail update');
  await assertPrivate(privateReceipt.videoId,input.accessToken,transport);
  const result:ThumbnailReceipt={schemaVersion:'1.0',status:'THUMBNAIL_UPLOADED',episodeId:ep.episodeId,
   videoId:privateReceipt.videoId,imageHash:thumbnailRecord.imageHash,sourceHash:thumbnailRecord.sourceHash,uploadedAt:new Date().toISOString()};
  await writeFile(receiptFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  return result;
 }finally{await handle.close();await rm(lockFile,{force:true});}
}
