import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CreativeCatalog,draftFingerprint,validateCreativeFingerprint} from '../creative/catalog.js';
import {createNineMinuteLoadFixture} from '../tools/load-fixture.js';

const reference=createNineMinuteLoadFixture();
const brief={schemaVersion:'1.0' as const,episodeId:reference.episodeId,premise:'Leo crea un enorme protocolo para ordenar el cajón familiar y no encuentra las pilas del mando.',targetMinutes:9,priorSummaries:[]};
const finger=draftFingerprint(brief,reference);
const changed={...reference,episodeId:'EP0088'};
const changedBrief={...brief,episodeId:'EP0088',premise:'Leo construye un protocolo complicadísimo para organizar el cajón y después no logra encontrar las pilas del mando.'};

test('creative catalog persists and detects similar premises without claiming original work',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'anymotion-creative-'));
 try{
  const file=join(dir,'catalog.sqlite');
  const catalog=new CreativeCatalog(file);
  try{
   const first=catalog.registerDraft(reference,finger);
   assert.equal(first.status,'DRAFT');assert.equal(catalog.registerDraft(reference,finger).episodeHash,first.episodeHash);
   assert.equal(catalog.list().length,1);
   const match=catalog.assess(draftFingerprint(changedBrief,changed));
   assert.equal(match.status,'EDITORIAL_REVIEW_REQUIRED');
   assert.equal(match.scannedEntries,1);
   assert.equal(match.matches[0]?.episodeId,reference.episodeId);
   assert(match.matches[0]!.sharedTerms.includes('cajon'));
   const context=catalog.contextualizeBrief(changedBrief);
   assert(context.priorSummaries.some(s=>s.includes('cajón')));
   await assert.rejects(()=>catalog.confirmEditorialApproval(reference,dir)); // No forged human approval.
  }finally{catalog.close();}
  const reopened=new CreativeCatalog(file);
  try{assert.equal(reopened.get(reference.episodeId)?.status,'DRAFT');}
  finally{reopened.close();}
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('immutable catalog entries reject changes and forbidden unstructured metadata',()=>{
 const catalog=new CreativeCatalog(':memory:');
 try{
  catalog.registerDraft(reference,finger);
  assert.throws(()=>catalog.registerDraft({...reference,title:'Changed story title'},finger),/immutable/);
  assert.throws(()=>catalog.registerDraft(changed,finger),/IDs differ/);
  assert.throws(()=>validateCreativeFingerprint({...finger,tags:['mando','MANDO']}),/Duplicate/);
  assert.throws(()=>validateCreativeFingerprint({...finger,mainProp:'<script>alert(1)</script>'}),/Invalid creative mainProp/);
  assert.throws(()=>validateCreativeFingerprint({...finger,untrustedCode:'eval()'}),/fields/);
  const different={...finger,episodeId:'EP0088',premise:'Vera intenta ahorrar energía mediante una agenda y Leo instala temporizadores domésticos.',summary:'La factura de electricidad provoca un conflicto diferente'};
  const result=catalog.assess(different);
  assert.equal(result.scannedEntries,1);
  assert.equal(result.status,'EDITORIAL_REVIEW_REQUIRED');
 }finally{catalog.close();}
});

test('catalog retains structural similarity evidence in the fingerprint',()=>{
 const db=new CreativeCatalog(':memory:');
 try{
  const rich={...finger,mainProp:'mando',conflictType:'control doméstico',escalationPattern:'burocracia creciente',resolutionType:'descubre objeto perdido',dominantCharacter:'leo' as const,tags:['organizacion','control']};
  db.registerDraft(reference,rich);
  const assessment=db.assess({...rich,episodeId:'EP0900'});
  assert.equal(assessment.matches.length,1);
  assert(assessment.matches[0]!.matchingDimensions.includes('mainProp'));
  assert.equal(assessment.repeatedPremiseRisk,true);
 }finally{db.close();}
});
