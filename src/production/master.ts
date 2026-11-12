/** A master must be verified on every restart, not trusted merely because the MP4 exists. */
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {withinRoot} from '../core/filenames.js';
import {validateEpisode,type Episode} from '../core/contracts.js';
import {currentRendererBackend} from '../renderer/raster.js';

export async function verifyMaster(episodeInput:Episode,preset:'preview'|'final',root=resolve(process.cwd())):Promise<string>{
 const episode=validateEpisode(episodeInput);
 const dir=withinRoot(root,join('productions',episode.episodeId,preset));
 const main=join(dir,'silent.mp4');
 const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8')) as {
  schemaVersion:string;episodeId:string;status:string;sourceHash:string;durationMs:number;renderer?:string;artifacts:Array<{path:string;sha256:string}>;
 };
 if(manifest.renderer&&manifest.renderer!==currentRendererBackend())throw new Error('Renderer backend differs from the frozen master; archive before changing the renderer');
 if(manifest.schemaVersion!=='1.0'||manifest.episodeId!==episode.episodeId||manifest.status!=='MASTER_RENDERED'||
   manifest.sourceHash!==createHash('sha256').update(JSON.stringify(episode)).digest('hex')||manifest.durationMs!==episode.durationMs)
   throw new Error('Existing master does not match episode contract and revision');
 const media=await stat(main);
 if(!media.isFile()||media.size<1000)throw new Error('Master video is empty');
 const qa=JSON.parse(await readFile(join(dir,'quality-report.json'),'utf8')) as {technicalPass?:boolean};
 if(qa.technicalPass!==true)throw new Error('Existing master has no technical quality approval');
 let mainFound=false;
 for(const a of manifest.artifacts){
  if(!a.path.startsWith(`productions/${episode.episodeId}/`)||!/^[a-f0-9]{64}$/.test(a.sha256))throw new Error('Unsafe artifact entry in master manifest');
  const actual=withinRoot(root,a.path);
  const digest=createHash('sha256');for await(const chunk of createReadStream(actual))digest.update(chunk);
  if(digest.digest('hex')!==a.sha256)throw new Error(`Existing master artifact was modified: ${a.path}`);
  if(actual===main)mainFound=true;
 }
 if(!mainFound)throw new Error('Master MP4 was omitted from its artifact manifest');
 return main;
}
