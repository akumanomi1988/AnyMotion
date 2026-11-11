/** Reproducible vector-derived thumbnail, separate from the immutable master video. */
import {readFile,writeFile,mkdir,rm,rename,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {renderSvgFrame} from '../renderer/scene.js';
import {validateEpisode,type Episode} from '../core/contracts.js';
import {withinRoot} from '../core/filenames.js';
import {runTool} from '../audio/dubbing.js';

const digest=(s:Buffer|string)=>createHash('sha256').update(s).digest('hex');
export interface ThumbnailManifest {schemaVersion:'1.0';episodeId:string;frameMs:number;sourceHash:string;imageHash:string;width:1280;height:720;status:'THUMBNAIL_READY'}
export function makeThumbnailSvg(input:Episode,frameMs:number):string{
 const ep=validateEpisode(input);
 if(!Number.isSafeInteger(frameMs)||frameMs<0||frameMs>=ep.durationMs)throw new Error('Thumbnail time outside episode');
 return renderSvgFrame(ep,Math.floor(frameMs*30/1000),30,1280,720);
}
export async function makeThumbnail(episodeInput:Episode,frameMs:number,root=resolve(process.cwd())):Promise<ThumbnailManifest>{
 const ep=validateEpisode(episodeInput);
 const svg=makeThumbnailSvg(ep,frameMs);
 const dir=withinRoot(root,join('productions',ep.episodeId,'thumbnails'));
 await mkdir(dir,{recursive:true});
 const out=join(dir,'thumbnail.png'),record=join(dir,'thumbnail.json');
 const sourceHash=digest(JSON.stringify(ep));
 const previous=await stat(record).then(()=>true,(e:NodeJS.ErrnoException)=>e.code==='ENOENT'?false:Promise.reject(e));
 if(previous){
  const saved=JSON.parse(await readFile(record,'utf8')) as ThumbnailManifest;
  if(saved.sourceHash!==sourceHash||saved.frameMs!==frameMs||saved.status!=='THUMBNAIL_READY'||digest(await readFile(out))!==saved.imageHash)
   throw new Error('Existing thumbnail belongs to another revision or has changed');
  return saved;
 }
 if(await stat(out).then(()=>true,()=>false))throw new Error('Thumbnail PNG exists without validated manifest');
 const tmp=withinRoot(root,join('workspace','temp',`thumbnail-${ep.episodeId}-${process.pid}-${Date.now()}`));
 await mkdir(tmp,{recursive:true});
 try{
  const source=join(tmp,'source.svg'),png=join(tmp,'render.png');
  await writeFile(source,svg);
  await runTool('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-i',source,'-frames:v','1','-update','1',png]);
  const data=JSON.parse(await runTool('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height','-of','json',png])) as {streams?:Array<{codec_name:string;width:number;height:number}>};
  if(data.streams?.[0]?.width!==1280||data.streams[0].height!==720||data.streams[0].codec_name!=='png')throw new Error('Thumbnail image QA failed');
  const imageHash=digest(await readFile(png));
  const manifest:ThumbnailManifest={schemaVersion:'1.0',episodeId:ep.episodeId,frameMs,sourceHash,imageHash,width:1280,height:720,status:'THUMBNAIL_READY'};
  await rename(png,out);
  await writeFile(record,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return manifest;
 }finally{await rm(tmp,{recursive:true,force:true});}
}
