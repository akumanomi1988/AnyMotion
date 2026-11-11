import {readFile,writeFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {type Episode, validateEpisode} from '../core/contracts.js';
import {withinRoot} from '../core/filenames.js';
import type {Locale,DubManifest} from '../audio/dubbing.js';
import type {FrozenTimeline} from '../timeline/freeze.js';

export interface ReleaseManifest {
  schemaVersion:'1.0'; episodeId:string; preset:'preview'|'final'; locales:Locale[];
  status:'TECHNICAL_PASS_EDITORIAL_PENDING'; publicationAllowed:false;
  artifacts:Record<string,string>; createdAt:string;
}
const sha=(s:Buffer|string)=>createHash('sha256').update(s).digest('hex');
async function shaFile(file:string){const d=createHash('sha256');for await(const b of createReadStream(file))d.update(b);return d.digest('hex');}

/** Package only verified byte-addressed artifacts. Never auto-approve or publish. */
export async function packageEpisode(episodeInput:Episode,preset:'preview'|'final',locales:Locale[],root=resolve(process.cwd())):Promise<ReleaseManifest>{
  const episode=validateEpisode(episodeInput);
  if(!locales.length||new Set(locales).size!==locales.length)throw new Error('Localizations must be a unique nonempty list');
  const dir=withinRoot(root,join('productions',episode.episodeId));
  const masterDir=join(dir,preset);
  const frozen=JSON.parse(await readFile(join(dir,'timeline.json'),'utf8')) as FrozenTimeline;
  if(frozen.status!=='TIMELINE_FROZEN'||frozen.episodeHash!==sha(JSON.stringify(episode))||frozen.durationMs!==episode.durationMs)throw new Error('Source timeline not frozen or does not match episode');
  const masterManifest=JSON.parse(await readFile(join(masterDir,'manifest.json'),'utf8')) as {status:string;episodeId:string;sourceHash?:string;artifacts:{path:string;sha256:string}[]};
  const qa=JSON.parse(await readFile(join(masterDir,'quality-report.json'),'utf8')) as {technicalPass:boolean};
  if(masterManifest.status!=='MASTER_RENDERED'||masterManifest.episodeId!==episode.episodeId||masterManifest.sourceHash!==sha(JSON.stringify(episode))||qa.technicalPass!==true)throw new Error('Master QA has not passed');
  const hashes:Record<string,string>={};
  hashes[join('productions',episode.episodeId,'timeline.json').replaceAll('\\','/')]=sha(await readFile(join(dir,'timeline.json')));
  for(const name of ['manifest.json','quality-report.json'])
    hashes[join('productions',episode.episodeId,preset,name).replaceAll('\\','/')]=await shaFile(join(masterDir,name));
  for(const item of masterManifest.artifacts){
    const path=withinRoot(root,item.path);
    if(await shaFile(path)!==item.sha256)throw new Error(`Master artifact hash mismatch: ${item.path}`);
    hashes[item.path]=item.sha256;
  }
  for(const locale of locales){
    if(locale!=='es-ES'&&locale!=='en-US')throw new Error('Unsupported locale');
    const folder=join(dir,'locales',locale);
    const dub=JSON.parse(await readFile(join(folder,'dub-manifest.json'),'utf8')) as DubManifest;
    if(dub.episodeId!==episode.episodeId||dub.locale!==locale||dub.status!=='LOCALIZED'||dub.timelineSha256!==sha(JSON.stringify(episode)))throw new Error(`Dub validation failed for ${locale}`);
    for(const [file,checksum] of Object.entries(dub.files)){
      const relative=join('productions',episode.episodeId,'locales',locale,file).replaceAll('\\','/');
      if(await shaFile(join(folder,file))!==checksum)throw new Error(`Dub hash mismatch ${relative}`);
      hashes[relative]=checksum;
    }
    const muxFile=join(folder,`mux_${preset}.json`);
    const mux=JSON.parse(await readFile(muxFile,'utf8')) as {technicalPass:boolean;outputHash:string;durationMs:number};
    const name=`final_${preset}.mp4`;
    if(!mux.technicalPass||mux.durationMs!==episode.durationMs||await shaFile(join(folder,name))!==mux.outputHash)throw new Error(`Mux validation failed for ${locale}`);
    hashes[join('productions',episode.episodeId,'locales',locale,name).replaceAll('\\','/')]=mux.outputHash;
    hashes[join('productions',episode.episodeId,'locales',locale,'dub-manifest.json').replaceAll('\\','/')]=await shaFile(join(folder,'dub-manifest.json'));
    hashes[join('productions',episode.episodeId,'locales',locale,`mux_${preset}.json`).replaceAll('\\','/')]=await shaFile(muxFile);
  }
  const out=join(dir,`release_${preset}.json`);
  const manifest:ReleaseManifest={schemaVersion:'1.0',episodeId:episode.episodeId,preset,locales,status:'TECHNICAL_PASS_EDITORIAL_PENDING',publicationAllowed:false,artifacts:hashes,createdAt:new Date().toISOString()};
  try {
    await stat(out);
    const existing = JSON.parse(await readFile(out,'utf8')) as ReleaseManifest;
    if(existing.status==='TECHNICAL_PASS_EDITORIAL_PENDING' && existing.publicationAllowed===false && existing.preset===preset && JSON.stringify(existing.locales)===JSON.stringify(locales) && JSON.stringify(existing.artifacts)===JSON.stringify(hashes))return existing;
    throw new Error(`Existing release differs from current inputs: ${out}`);
  }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  await writeFile(out,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return manifest;
}
