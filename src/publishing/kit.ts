/** Offline, hash-verified export for YouTube Studio multi-audio upload. */
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile,mkdir,readFile,readdir,rename,rm,stat,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {withinRoot} from '../core/filenames.js';
import {validateEpisode,type Episode} from '../core/contracts.js';
import {verifyEditorialApproval,verifiedRelease} from './approval.js';
import {validateVideoMetadata,type VideoMetadata} from './youtube.js';
import type {ThumbnailManifest} from '../production/thumbnail.js';

export interface StudioKitManifest {
 schemaVersion:'1.0';episodeId:string;status:'STUDIO_KIT_READY';revision:string;
 releaseHash:string;metadataHash:string;thumbnailHash:string;files:Record<string,string>;
}
const digest=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
async function hashFile(path:string):Promise<string>{const h=createHash('sha256');for await(const c of createReadStream(path))h.update(c);return h.digest('hex');}
async function exists(path:string):Promise<boolean>{return stat(path).then(()=>true,(e:NodeJS.ErrnoException)=>e.code==='ENOENT'?false:Promise.reject(e));}
export async function verifyStudioKit(manifest:StudioKitManifest,folder:string):Promise<void>{
 if(manifest.status!=='STUDIO_KIT_READY'||!manifest.files||!Object.keys(manifest.files).length)throw new Error('Invalid Studio kit manifest');
 const entries=await readdir(folder,{recursive:true,withFileTypes:true});
 if(entries.some(x=>x.isSymbolicLink()))throw new Error('Studio kit must not contain symlinks');
 const names=entries.filter(x=>x.isFile());
 // Every documented file is hashed; untracked additions block a purported verified kit.
 const listed=Object.keys(manifest.files).sort();
 if(names.length!==listed.length+1)throw new Error('Studio kit file inventory mismatch'); // + kit.json itself
 for(const [path,checksum] of Object.entries(manifest.files)){
  if(!/^[a-f0-9]{64}$/.test(checksum)||await hashFile(withinRoot(folder,path))!==checksum)
   throw new Error(`Studio kit artifact changed: ${path}`);
 }
}
/** Creates an immutable export folder. No API calls, publication or mutation of source masters. */
export async function createStudioKit(input:{episode:Episode;metadata:VideoMetadata;root?:string}):Promise<{dir:string;manifest:StudioKitManifest}>{
 const ep=validateEpisode(input.episode),metadata=validateVideoMetadata(input.metadata);
 const root=resolve(input.root??process.cwd());
 await verifyEditorialApproval(ep,root);
 const release=await verifiedRelease(ep,'final',root);
 const base=withinRoot(root,join('productions',ep.episodeId));
 const thumbManifest=JSON.parse(await readFile(join(base,'thumbnails','thumbnail.json'),'utf8')) as ThumbnailManifest;
 const thumb=join(base,'thumbnails','thumbnail.png');
 const thumbnailHash=await hashFile(thumb);
 if(thumbManifest.status!=='THUMBNAIL_READY'||thumbManifest.episodeId!==ep.episodeId||thumbManifest.imageHash!==thumbnailHash||thumbManifest.sourceHash!==digest(JSON.stringify(ep)))throw new Error('Thumbnail not ready or changed');
 const metadataHash=digest(JSON.stringify(metadata)),releaseHash=release.sha256;
 const revision=digest(`${releaseHash}:${metadataHash}:${thumbnailHash}`).slice(0,20);
 const dest=withinRoot(base,join('studio-kit',revision));
 if(await exists(dest)){
  const prev=JSON.parse(await readFile(join(dest,'kit.json'),'utf8')) as StudioKitManifest;
  if(prev.releaseHash!==releaseHash||prev.metadataHash!==metadataHash||prev.thumbnailHash!==thumbnailHash||prev.revision!==revision)throw new Error('Existing Studio kit has a mismatched source revision');
  await verifyStudioKit(prev,dest);
  return {dir:dest,manifest:prev};
 }
 const folder=withinRoot(base,join('studio-kit',`.building-${revision}-${process.pid}-${Date.now()}`));
 await mkdir(folder,{recursive:true});
 const hashes:Record<string,string>={};
 async function addFile(relative:string,from:string):Promise<void>{
  const destFile=withinRoot(folder,relative);
  await mkdir(resolve(destFile,'..'),{recursive:true});
  await copyFile(from,destFile);
  if(await hashFile(from)!==await hashFile(destFile))throw new Error(`Studio export changed during copy: ${relative}`);
  hashes[relative]=await hashFile(destFile);
 }
 async function addText(relative:string,content:string):Promise<void>{
  const path=withinRoot(folder,relative);await mkdir(resolve(path,'..'),{recursive:true});
  await writeFile(path,content,'utf8');hashes[relative]=await hashFile(path);
 }
 try{
  await addFile('video_es-ES.mp4',join(base,'locales',ep.sourceLocale,'final_final.mp4'));
  await addFile('thumbnail.png',thumb);
  for(const locale of release.manifest.locales){
   const src=join(base,'locales',locale);
   await addFile(`audio_${locale}.wav`,join(src,'full_audio.wav'));
   for(const speaker of ['combined','vera','leo'])await addFile(`captions/${locale}/${speaker}.srt`,join(src,`${speaker}.srt`));
  }
  await addText('metadata.json',JSON.stringify(metadata,null,2)+'\n');
  await addText('STUDIO_GUIDE.md',[`# AnyMotion ${ep.episodeId} · Studio delivery`,
    '',`Approved release: ${releaseHash}`,`Languages: ${release.manifest.locales.join(', ')}`,'',
    '1. Upload video_es-ES.mp4 to YouTube Studio as a **private** video, never public by default.',
    '2. Apply the title/description/classification in metadata.json and the original thumbnail.',
    '3. Upload captions/<locale>/combined.srt as the accessibility subtitles for each locale.',
    '4. For supported channels, add audio_<locale>.wav via YouTube Studio language/audio tracks.',
    '5. Review playback, timing, localization and privacy manually before scheduling publication.',
    '6. Do not upload per-character SRTs as separate public tracks; they are source/diagnostic artifacts.',
    '', 'This bundle does not imply that the channel supports multilingual audio or that anything was published.',
    ''].join('\n'));
  const manifest:StudioKitManifest={schemaVersion:'1.0',episodeId:ep.episodeId,status:'STUDIO_KIT_READY',revision,releaseHash,metadataHash,thumbnailHash,files:hashes};
  await writeFile(join(folder,'kit.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  await verifyStudioKit(manifest,folder);
  await mkdir(resolve(dest,'..'),{recursive:true});
  await rename(folder,dest);
  return {dir:dest,manifest};
 }finally{await rm(folder,{recursive:true,force:true});}
}
