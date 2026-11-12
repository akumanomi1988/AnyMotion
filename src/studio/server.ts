/** Read-only operator preview UI, listening exclusively on loopback. */
import {createServer,type Server,type IncomingMessage,type ServerResponse} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,readdir,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {withinRoot} from '../core/filenames.js';

export interface StudioEpisode {episodeId:string;status:string;durationMs:number|null; locales:string[];artifactCount:number;videoReady:Record<string,boolean>}
const ID=/^[A-Z0-9][A-Z0-9_-]{2,63}$/;
const LOCALES=['es-ES','en-US'] as const;
const PRESETS=['preview','final'] as const;
const escape=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const secureHeaders={
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
 'Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
async function loadJson(file:string):Promise<unknown|null>{
 try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
}
const hasFile=async(file:string):Promise<boolean>=>stat(file).then(s=>s.isFile(),(e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return false;throw e;});
export async function listStudioEpisodes(root:string):Promise<StudioEpisode[]>{
 const productions=withinRoot(root,'productions');
 let entries:string[];
 try{entries=await readdir(productions);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
 const items:StudioEpisode[]=[];
 for(const id of entries){
  if(!ID.test(id))continue;
  const directory=withinRoot(productions,id);
  if(!(await stat(directory)).isDirectory())continue;
  const release=(await loadJson(join(directory,'release_final.json'))??await loadJson(join(directory,'release_preview.json'))) as {status?:unknown;locales?:unknown;artifacts?:unknown}|null;
  const timeline=await loadJson(join(directory,'timeline.json')) as {durationMs?:unknown}|null;
  const videoReady:Record<string,boolean>={};
  for(const locale of LOCALES)for(const preset of PRESETS)
   videoReady[`${locale}:${preset}`]=await hasFile(join(directory,'locales',locale,`final_${preset}.mp4`));
  items.push({episodeId:id,status:typeof release?.status==='string'?release.status:'INCOMPLETE',
   durationMs:typeof timeline?.durationMs==='number'&&Number.isSafeInteger(timeline.durationMs)?timeline.durationMs:null,
   locales:Array.isArray(release?.locales)?release.locales.filter((x):x is string=>typeof x==='string'&&LOCALES.includes(x as typeof LOCALES[number])):[],
   artifactCount:release?.artifacts&&typeof release.artifacts==='object'&&!Array.isArray(release.artifacts)?Object.keys(release.artifacts).length:0,videoReady});
 }
 return items.sort((a,b)=>b.episodeId.localeCompare(a.episodeId)).slice(0,500);
}
const css=`:root{color-scheme:dark;font-family:system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:#0e1726;color:#e9f0f7}main{max-width:1120px;margin:auto;padding:32px 24px}h1{font-size:26px;margin:0 0 8px}h2{font-size:19px}p,small{color:#a8b8ca}a{color:#8bddff}.panel{border:1px solid #32495f;background:#172638;border-radius:14px;padding:24px;margin:18px 0}.badge{color:#c2ebdc;background:#214e4c;padding:5px 11px;border-radius:24px;font-size:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}video{width:100%;aspect-ratio:16/9;display:block;background:#030506;border-radius:9px}header{display:flex;justify-content:space-between;gap:20px;align-items:center}footer{margin-top:28px;font-size:12px;color:#96a8bb}`;
function html(title:string,body:string):string{
 return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · AnyMotion</title><style>${css}</style></head><body><main><header><div><h1>AnyMotion Studio</h1><small>Consola local de producciones · Solo lectura</small></div><span class="badge">Sin publicación automática</span></header>${body}<footer>Escucha únicamente en 127.0.0.1. No exponer con proxies sin autenticación.</footer></main></body></html>`;
}
function send(res:ServerResponse,status:number,type:string,body:string):void{
 res.writeHead(status,{...secureHeaders,'Content-Type':type,'Content-Length':Buffer.byteLength(body)});res.end(body);
}
async function media(req:IncomingMessage,res:ServerResponse,file:string):Promise<void>{
 const st=await stat(file).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});
 if(!st||!st.isFile()){send(res,404,'text/plain;charset=utf-8','Vídeo no encontrado');return;}
 if(st.size===0){send(res,409,'text/plain;charset=utf-8','Vídeo vacío');return;}
 let start=0,end=st.size-1,status=200;
 if(req.headers.range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(!match||(!match[1]&&!match[2])){res.writeHead(416,{...secureHeaders,'Content-Range':`bytes */${st.size}`});res.end();return;}
  if(!match[1]){const length=Number(match[2]);start=Math.max(0,st.size-length);}
  else{start=Number(match[1]);end=match[2]?Number(match[2]):end;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=st.size){res.writeHead(416,{...secureHeaders,'Content-Range':`bytes */${st.size}`});res.end();return;}
  end=Math.min(end,st.size-1);status=206;
 }
 res.writeHead(status,{...secureHeaders,'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':String(end-start+1),...(status===206?{'Content-Range':`bytes ${start}-${end}/${st.size}`}:{})});
 if(req.method==='HEAD'){res.end();return;}
 const fileStream=createReadStream(file,{start,end});fileStream.once('error',()=>res.destroy());fileStream.pipe(res);
}
export async function startStudioServer(root=resolve(process.cwd()),port=4321):Promise<{server:Server;port:number}>{
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid studio port');
 const base=resolve(root);
 const server=createServer(async(req,res)=>{
  try{
   if(req.method!=='GET'&&req.method!=='HEAD'){send(res,405,'text/plain;charset=utf-8','Solo lectura');return;}
   const url=new URL(req.url??'/', 'http://127.0.0.1');
   if(url.search){send(res,400,'text/plain;charset=utf-8','Parámetros no admitidos');return;}
   if(url.pathname==='/api/episodes'){
    send(res,200,'application/json;charset=utf-8',JSON.stringify(await listStudioEpisodes(base)));return;
   }
   if(url.pathname==='/'){
    const episodes=await listStudioEpisodes(base);
    const body=episodes.length?episodes.map(ep=>`<section class="panel"><h2><a href="/episodes/${ep.episodeId}">${escape(ep.episodeId)}</a></h2><p>${escape(ep.status)} · ${ep.durationMs===null?'Duración pendiente':(ep.durationMs/1000).toFixed(1)+' s'} · ${ep.artifactCount} artefactos</p><p>Idiomas: ${escape(ep.locales.join(', ')||'Sin localizar')}</p></section>`).join(''):
     '<section class="panel"><h2>Sin producciones</h2><p>Ejecuta el pipeline local para crear la primera.</p></section>';
    send(res,200,'text/html;charset=utf-8',html('Producciones',`<h2>Producciones</h2>${body}`));return;
   }
   const detail=/^\/episodes\/([A-Z0-9][A-Z0-9_-]{2,63})$/.exec(url.pathname);
   if(detail){
    const ep=(await listStudioEpisodes(base)).find(e=>e.episodeId===detail[1]);
    if(!ep){send(res,404,'text/plain;charset=utf-8','Episodio no encontrado');return;}
    const videos=LOCALES.flatMap(locale=>PRESETS.filter(p=>ep.videoReady[`${locale}:${p}`]).map(p=>`<section class="panel"><h2>${escape(locale)} · ${p==='final'?'Final':'Vista previa'}</h2><video controls preload="metadata" src="/media/${ep.episodeId}/${locale}/${p}"></video></section>`));
    send(res,200,'text/html;charset=utf-8',html(ep.episodeId,`<p><a href="/">Volver</a></p><h2>Episodio ${ep.episodeId}</h2><p>Estado: ${escape(ep.status)} · ${ep.artifactCount} archivos vinculados al paquete</p><div class="grid">${videos.join('')||'<section class="panel">Sin vídeos aún.</section>'}</div>`));return;
   }
   const path=/^\/media\/([A-Z0-9][A-Z0-9_-]{2,63})\/(es-ES|en-US)\/(preview|final)$/.exec(url.pathname);
   if(path){await media(req,res,withinRoot(base,join('productions',path[1]!,'locales',path[2]!,`final_${path[3]}.mp4`)));return;}
   send(res,404,'text/plain;charset=utf-8','Ruta no encontrada');
  }catch{send(res,500,'text/plain;charset=utf-8','Error de lectura');}
 });
 await new Promise<void>((ok,bad)=>{server.once('error',bad);server.listen(port,'127.0.0.1',()=>{server.off('error',bad);ok();});});
 const addr=server.address();if(!addr||typeof addr==='string')throw new Error('Unexpected studio address');
 return {server,port:addr.port};
}
