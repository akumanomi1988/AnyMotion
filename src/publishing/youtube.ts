/** Official YouTube Data API private-only resumable upload, guarded by editorial approval. */
import {open,readFile,writeFile,stat,mkdir,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {withinRoot} from '../core/filenames.js';
import {type Episode,validateEpisode} from '../core/contracts.js';
import {verifyEditorialApproval,verifiedRelease} from './approval.js';

export interface VideoMetadata {title:string;description:string;tags?:string[];categoryId:string;madeForKids:boolean}
export interface UploadResult {videoId:string;status:'PRIVATE_UPLOADED';privacyStatus:'private';sourceSha256:string;metadataSha256:string;uploadedAt:string}
export type Transport = (input:string|URL,init?:RequestInit)=>Promise<Response>;
const MAX_CHUNK=8*1024*1024;
async function shaFile(file:string):Promise<string>{const digest=createHash('sha256');for await(const block of createReadStream(file))digest.update(block);return digest.digest('hex');}
const exists=async(file:string)=>stat(file).then(()=>true,(e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return false;throw e;});

export function validateVideoMetadata(input:unknown):VideoMetadata {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid video metadata');
 const m=input as Record<string,unknown>;
 if(Object.keys(m).some(k=>!['title','description','tags','categoryId','madeForKids'].includes(k)))throw new Error('Unknown YouTube metadata fields');
 if(typeof m.title!=='string'||m.title.trim().length<8||m.title.length>100)throw new Error('Title must contain 8–100 characters');
 if(typeof m.description!=='string'||m.description.trim().length<30||m.description.length>5000)throw new Error('Description must contain 30–5000 characters');
 if(m.tags!==undefined&&(!Array.isArray(m.tags)||m.tags.length>20||m.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>40)))throw new Error('Invalid tags');
 if(typeof m.categoryId!=='string'||!/^[0-9]{1,3}$/.test(m.categoryId))throw new Error('Explicit categoryId required');
 if(typeof m.madeForKids!=='boolean')throw new Error('Explicit madeForKids classification required');
 return input as VideoMetadata;
}
function sessionUrl(location:string):string {
 const parsed=new URL(location);
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port||!['www.googleapis.com','upload.googleapis.com'].includes(parsed.hostname)||
   !parsed.pathname.startsWith('/upload/youtube/v3/videos'))throw new Error('Untrusted YouTube upload session endpoint');
 return parsed.toString();
}
async function responseJson(response:Response):Promise<Record<string,unknown>> {
 const raw=await response.text();
 if(raw.length>100000)throw new Error('Oversized YouTube API response');
 try { return JSON.parse(raw) as Record<string,unknown>; }catch { throw new Error(`Unexpected YouTube response HTTP ${response.status}`); }
}
const assertVideoId=(id:unknown):string=>{if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{8,32}$/.test(id))throw new Error('YouTube returned an invalid video ID');return id;};
async function checkedResponse(response:Response,ok:number[]):Promise<void>{
 if(!ok.includes(response.status))throw new Error(`YouTube API HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
}

/** Two-phase operator flow. No public visibility, no default upload. */
export async function uploadPrivateVideo(input:{episode:Episode;metadata:VideoMetadata;accessToken:string;confirm:string;root?:string;transport?:Transport;chunkBytes?:number}):Promise<UploadResult>{
 const ep=validateEpisode(input.episode);
 if(input.confirm!==`UPLOAD_PRIVATE:${ep.episodeId}`)throw new Error('Explicit private-upload confirmation required');
 if(!input.accessToken.trim()||input.accessToken.length>8192)throw new Error('Missing or malformed OAuth access token');
 const metadata=validateVideoMetadata(input.metadata);
 const root=resolve(input.root??process.cwd());
 await verifyEditorialApproval(ep,root);
 const release=await verifiedRelease(ep,'final',root);
 if(!release.manifest.locales.includes(ep.sourceLocale))throw new Error('No validated source locale');
 const video=withinRoot(root,join('productions',ep.episodeId,'locales',ep.sourceLocale,'final_final.mp4'));
 const details=await stat(video);
 if(details.size<1000)throw new Error('Video file empty');
 const sourceSha256=await shaFile(video);
 const metadataSha256=createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
 const transport=input.transport??fetch;
 const base=withinRoot(root,join('productions',ep.episodeId,'publication'));
 await mkdir(base,{recursive:true});
 const receipt=join(base,'youtube-private.json');
 if(await exists(receipt)){
   const previous=JSON.parse(await readFile(receipt,'utf8')) as UploadResult;
   if(previous.sourceSha256!==sourceSha256||previous.metadataSha256!==metadataSha256)throw new Error('Existing publication receipt belongs to another video or metadata revision');
   await assertRemotePrivate(previous.videoId,transport,{Authorization:`Bearer ${input.accessToken}`});
   return previous;
 }
 const sessionFile=join(base,'youtube-upload-session.json');
 const lock=join(base,'youtube-upload.lock');
 const lockFile=await open(lock,'wx').catch(()=>{throw new Error('Private upload already running; inspect lock/session before retrying');});
 try{
   const headers={Authorization:`Bearer ${input.accessToken}`};
   let session:string;
   if(await exists(sessionFile)){
     const saved=JSON.parse(await readFile(sessionFile,'utf8')) as {url:string;sourceSha256:string;size:number};
     if(saved.sourceSha256!==sourceSha256||saved.size!==details.size||(saved as {metadataSha256?:string}).metadataSha256!==metadataSha256)throw new Error('Upload session is for another file/metadata revision');
     session=sessionUrl(saved.url);
   }else{
     const body={snippet:{title:metadata.title,description:metadata.description,tags:metadata.tags??[],categoryId:metadata.categoryId,defaultLanguage:ep.sourceLocale},status:{privacyStatus:'private',selfDeclaredMadeForKids:metadata.madeForKids}};
     const endpoint='https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
     const init=await transport(endpoint,{method:'POST',redirect:'manual',headers:{...headers,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(details.size),'X-Upload-Content-Type':'video/mp4'},body:JSON.stringify(body)});
     await checkedResponse(init,[200]);
     session=sessionUrl(init.headers.get('location')??'');
     await writeFile(sessionFile,JSON.stringify({url:session,sourceSha256,metadataSha256,size:details.size})+'\n',{flag:'wx'});
   }
   const query=await transport(session,{method:'PUT',redirect:'manual',headers:{...headers,'Content-Length':'0','Content-Range':`bytes */${details.size}`}});
   let offset:number;
   if(query.status===200||query.status===201){
     const response=await responseJson(query);
     return await finish(response,transport,headers,receipt,sourceSha256,metadataSha256);
   }
   await checkedResponse(query,[308]);
   offset=nextOffset(query.headers.get('range'),details.size);
   const chunk=input.chunkBytes??MAX_CHUNK;
   if(!Number.isInteger(chunk)||chunk<256*1024||chunk%(256*1024)!==0||chunk>MAX_CHUNK)throw new Error('Invalid upload chunk size');
   const fd=await open(video,'r');
   try{
     while(offset<details.size){
       const len=Math.min(chunk,details.size-offset);
       const bytes=Buffer.alloc(len);
       const got=await fd.read(bytes,0,len,offset);
       if(got.bytesRead!==len)throw new Error('Video changed during upload');
       const response=await transport(session,{method:'PUT',redirect:'manual',headers:{...headers,'Content-Type':'video/mp4','Content-Length':String(len),'Content-Range':`bytes ${offset}-${offset+len-1}/${details.size}`},body:bytes});
       if(response.status===308){
         const next=nextOffset(response.headers.get('range'),details.size);
         if(next<=offset)throw new Error('YouTube resumable upload did not make progress');
         offset=next;
       }else{
         await checkedResponse(response,[200,201]);
         const responseBody=await responseJson(response);
         if(await shaFile(video)!==sourceSha256)throw new Error('Source video changed during upload');
         return await finish(responseBody,transport,headers,receipt,sourceSha256,metadataSha256);
       }
     }
   }finally{await fd.close();}
   throw new Error('Upload finished without YouTube confirmation');
 }finally{await lockFile.close();await rm(lock,{force:true});}
}
function nextOffset(range:string|null,size:number):number{
 if(range===null)return 0;
 const m=/^bytes=0-(\d+)$/.exec(range);
 if(!m)throw new Error('Invalid upload resume Range');
 const next=Number(m[1])+1;
 if(!Number.isSafeInteger(next)||next>size||next<1)throw new Error('Invalid upload resume offset');
 return next;
}
async function assertRemotePrivate(id:string,transport:Transport,headers:{Authorization:string}):Promise<void>{
 const url=`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(assertVideoId(id))}`;
 const check=await transport(url,{method:'GET',redirect:'manual',headers});
 await checkedResponse(check,[200]);
 const verified=await responseJson(check);
 const items=verified.items;
 if(!Array.isArray(items)||items.length!==1||(items[0] as {id?:string}).id!==id||
    (items[0] as {status?:{privacyStatus?:string}}).status?.privacyStatus!=='private')
   throw new Error('Remote video is not verified private; do not continue');
}
async function finish(payload:Record<string,unknown>,transport:Transport,headers:{Authorization:string},receipt:string,digest:string,metadataSha256:string):Promise<UploadResult>{
 const id=assertVideoId(payload.id);
 await assertRemotePrivate(id,transport,headers);
 const result:UploadResult={videoId:id,status:'PRIVATE_UPLOADED',privacyStatus:'private',sourceSha256:digest,metadataSha256,uploadedAt:new Date().toISOString()};
 await writeFile(receipt,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
