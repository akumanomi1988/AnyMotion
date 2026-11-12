import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {validateEpisode} from '../core/contracts.js';
import {rightsInventory,attestRights,verifyRightsAttestation} from '../publishing/rights.js';
import {approveEditorial,verifyEditorialApproval} from '../publishing/approval.js';
import {createSoundscape} from '../audio/soundscape.js';
const sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const episode=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')) as unknown);
async function seed(root:string):Promise<void>{
 const prefix=`productions/${episode.episodeId}/`,folder=join(root,prefix);
 const files:Record<string,Buffer|string>={
  'final/silent.mp4':Buffer.alloc(1500,10),
  'final/manifest.json':'{}','final/quality-report.json':'{}','timeline.json':'{}',
 };
 for(const locale of ['es-ES','en-US']){
  files[`locales/${locale}/dub-manifest.json`]=JSON.stringify({status:'LOCALIZED',provider:'tts-http:commercial-provider-v1'});
  for(const name of ['final_final.mp4','speech-fit-report.json','mux_final.json','vera.srt','leo.srt','combined.srt'])
    files[`locales/${locale}/${name}`]=Buffer.alloc(150,locale==='es-ES'?13:14);
 }
 for(const [rel,bytes] of Object.entries(files)){await mkdir(dirname(join(folder,rel)),{recursive:true});await writeFile(join(folder,rel),bytes);}
 const design=JSON.parse(await readFile('examples/pilot.sound-design.json','utf8')) as unknown;
 await createSoundscape(episode,design,root);
 for(const name of ['music.wav','sfx.wav','sound-design.json','sound-manifest.json']){
  files[`audio/${name}`]=await readFile(join(folder,'audio',name));
 }
 const artifacts=Object.fromEntries(Object.entries(files).map(([rel,v])=>[prefix+rel,sha(v)]));
 const release={schemaVersion:'1.0',status:'TECHNICAL_PASS_EDITORIAL_PENDING',publicationAllowed:false,
  episodeId:episode.episodeId,preset:'final',locales:['es-ES','en-US'],artifacts,createdAt:new Date().toISOString()};
 await writeFile(join(folder,'release_final.json'),JSON.stringify(release)+'\n');
}
const options={reviewer:'Test Producer',notes:'I checked the original ownership of every visual and audio source for this exact release.',confirm:`ATTEST_RIGHTS:${episode.episodeId}`};
const claims=(materials:Awaited<ReturnType<typeof rightsInventory>>['materials'])=>materials.map(m=>({assetId:m.assetId,sha256:m.sha256,rightsHolder:'Studio Owner',basis:'original-owned',evidence:'Original work produced for this studio; ownership reviewed against the source assets.'}));
test('rights inventory is bound to video, two voice locales, soundtrack and SFX; no silent omissions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-rights-'));
 try{
  await seed(root);
  const inventory=await rightsInventory(episode,root);
  assert.deepEqual(inventory.materials.map(m=>m.assetId),['picture','voice:es-ES','voice:en-US','music','sfx']);
  await assert.rejects(()=>attestRights(episode,{...options,claims:claims(inventory.materials).slice(1)},root),/cover every/);
  const bad=claims(inventory.materials);bad[0]!.sha256='0'.repeat(64);
  await assert.rejects(()=>attestRights(episode,{...options,claims:bad},root),/hash changed/);
  await assert.rejects(()=>attestRights(episode,{...options,confirm:'y',claims:claims(inventory.materials)},root),/confirmation/);
  const attested=await attestRights(episode,{...options,claims:claims(inventory.materials)},root);
  assert.equal(attested.status,'RIGHTS_ATTESTED');
  assert.equal((await verifyRightsAttestation(episode,root)).attestation.claims.length,5);
  await assert.rejects(()=>attestRights(episode,{...options,claims:claims(inventory.materials)},root),/EEXIST/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('commercial approval cannot outlive rights evidence',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-rights-'));
 const previous=process.env.ANYMOTION_APPROVED_VOICE_PROVIDERS;
 process.env.ANYMOTION_APPROVED_VOICE_PROVIDERS='tts-http:commercial-provider-v1';
 try{
  await seed(root);
  const approval={reviewer:'Test Producer',reviewNotes:'I personally reviewed narrative, localization, rights and technical evidence.',confirm:`APPROVE:${episode.episodeId}`,commercialRightsConfirmed:true};
  await assert.rejects(()=>approveEditorial(episode,approval,root),/ENOENT/);
  const inventory=await rightsInventory(episode,root);
  await attestRights(episode,{...options,claims:claims(inventory.materials)},root);
  await approveEditorial(episode,approval,root);
  assert.equal((await verifyEditorialApproval(episode,root)).status,'EDITORIAL_APPROVED');
  const file=join(root,'productions',episode.episodeId,'rights-attestation.json');
  const data=JSON.parse(await readFile(file,'utf8')) as {notes:string};
  data.notes+=' Unauthorized change after approval';await writeFile(file,JSON.stringify(data));
  await assert.rejects(()=>verifyEditorialApproval(episode,root),/Rights evidence changed/);
 }finally{process.env.ANYMOTION_APPROVED_VOICE_PROVIDERS=previous;await rm(root,{recursive:true,force:true});}
});
test('commercially licensed rights cannot omit human license reference',async()=>{
 const root=await mkdtemp(join(tmpdir(),'anymotion-rights-'));
 try{await seed(root);const inventory=await rightsInventory(episode,root);
  const c=claims(inventory.materials);c[0]={...c[0]!,basis:'licensed-commercial'};
  await assert.rejects(()=>attestRights(episode,{...options,claims:c},root),/commercial license/);
 }finally{await rm(root,{recursive:true,force:true});}
});
