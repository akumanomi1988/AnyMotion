/** Explicit, hash-verified local archive and safe recovery. Never delete originals. */
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile,lstat,mkdir,readdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {validateEpisode,type Episode} from '../core/contracts.js';
import {withinRoot} from '../core/filenames.js';

export interface BackupManifest {
 schemaVersion:'1.0';episodeId:string;episodeSha256:string;createdAt:string;
 files:Record<string,{sha256:string;size:number}>;
}
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const SHA=/^[a-f0-9]{64}$/;
async function hashFile(file:string):Promise<string>{
 const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');
}
async function exists(file:string):Promise<boolean>{return stat(file).then(()=>true,(e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return false;throw e;});}
async function filesUnder(base:string,dir=base,ignoreBackupManifest=false):Promise<string[]>{
 const found:string[]=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(entry.isSymbolicLink())throw new Error(`Backup cannot follow symlinks: ${path}`);
  if(entry.isDirectory())found.push(...await filesUnder(base,path,ignoreBackupManifest));
  else if(entry.isFile()){
   const rel=relative(base,path).split(sep).join('/');
   if(rel==='backup-manifest.json'&&ignoreBackupManifest)continue;
   if(!rel || rel==='backup-manifest.json')throw new Error('Reserved or invalid backup artifact');
   found.push(rel);
  }else throw new Error(`Unsupported archive input: ${path}`);
 }
 return found.sort();
}
function safeBackupRoot(originalRoot:string,backupRoot:string){
 const b=resolve(backupRoot),productions=resolve(originalRoot,'productions');
 if(b===productions||b.startsWith(productions+sep))throw new Error('Backups must not be nested inside the productions directory');
 return b;
}
export async function verifyEpisodeBackup(episode:Episode,backupRoot:string):Promise<BackupManifest>{
 const ep=validateEpisode(episode),target=withinRoot(resolve(backupRoot),join(ep.episodeId,digest(JSON.stringify(ep))));
 const data=JSON.parse(await readFile(join(target,'backup-manifest.json'),'utf8')) as BackupManifest;
 if(data.schemaVersion!=='1.0'||data.episodeId!==ep.episodeId||data.episodeSha256!==digest(JSON.stringify(ep))||
    !data.files||typeof data.files!=='object'||Array.isArray(data.files)||!Object.keys(data.files).length)throw new Error('Invalid or mismatched backup manifest');
 const listed=await filesUnder(target,target,true);
 if(listed.length!==Object.keys(data.files).length||listed.some(path=>!(path in data.files)))throw new Error('Backup contains unexpected or missing files');
 for(const [rel,entry] of Object.entries(data.files)){
  if(!entry||!SHA.test(entry.sha256)||!Number.isSafeInteger(entry.size)||entry.size<0)throw new Error(`Invalid backup entry: ${rel}`);
  const file=withinRoot(target,rel);
  if((await lstat(file)).size!==entry.size||await hashFile(file)!==entry.sha256)throw new Error(`Corrupt backup artifact: ${rel}`);
 }
 return data;
}
export async function backupEpisode(episode:Episode,backupRoot:string,root=resolve(process.cwd())):Promise<BackupManifest>{
 const ep=validateEpisode(episode),source=withinRoot(root,join('productions',ep.episodeId));
 if(!(await exists(source)))throw new Error('Episode has no production artifacts to back up');
 const backup=safeBackupRoot(root,backupRoot),revision=digest(JSON.stringify(ep));
 const parent=withinRoot(backup,ep.episodeId),target=withinRoot(parent,revision);
 await mkdir(parent,{recursive:true});
 if(await exists(target))return verifyEpisodeBackup(ep,backup);
 const staging=withinRoot(parent,`.tmp-${revision}-${process.pid}-${Date.now()}`);
 const files=await filesUnder(source);
 if(!files.length)throw new Error('Episode source has no artifacts');
 const checks:BackupManifest['files']={};
 await mkdir(staging,{recursive:true});
 try {
  for(const rel of files){
   const from=withinRoot(source,rel),to=withinRoot(staging,rel);
   await mkdir(dirname(to),{recursive:true});
   await copyFile(from,to);
   const [originalHash,backupHash]=await Promise.all([hashFile(from),hashFile(to)]);
   if(originalHash!==backupHash)throw new Error(`Source changed during backup: ${rel}`);
   checks[rel]={sha256:backupHash,size:(await stat(to)).size};
  }
  const manifest:BackupManifest={schemaVersion:'1.0',episodeId:ep.episodeId,episodeSha256:revision,createdAt:new Date().toISOString(),files:checks};
  await writeFile(join(staging,'backup-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  await rename(staging,target);
  await verifyEpisodeBackup(ep,backup);
  return manifest;
 }finally{await rm(staging,{force:true,recursive:true});}
}
export async function restoreEpisodeBackup(episode:Episode,backupRoot:string,root=resolve(process.cwd())):Promise<BackupManifest>{
 const ep=validateEpisode(episode),archive=safeBackupRoot(root,backupRoot);
 const manifest=await verifyEpisodeBackup(ep,archive);
 const source=withinRoot(archive,join(ep.episodeId,manifest.episodeSha256));
 const productions=withinRoot(root,'productions'),target=withinRoot(productions,ep.episodeId);
 if(await exists(target))throw new Error('Refusing to overwrite existing production during restore');
 await mkdir(productions,{recursive:true});
 const staging=withinRoot(productions,`.restore-${ep.episodeId}-${process.pid}-${Date.now()}`);
 await mkdir(staging,{recursive:true});
 try{
  for(const [rel,entry] of Object.entries(manifest.files)){
   const dst=withinRoot(staging,rel);
   await mkdir(dirname(dst),{recursive:true});
   await copyFile(withinRoot(source,rel),dst);
   if(await hashFile(dst)!==entry.sha256)throw new Error(`Restore checksum mismatch: ${rel}`);
  }
  if(await exists(target))throw new Error('Refusing to overwrite concurrently created production');
  await rename(staging,target);
  return manifest;
 }finally{await rm(staging,{force:true,recursive:true});}
}
