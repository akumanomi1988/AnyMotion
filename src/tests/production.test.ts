import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ProductionJobStore,type JobSpec,jobKey} from '../production/jobs.js';
const spec:JobSpec={episodeId:'EP0001',stage:'DUB',locale:'en-US',inputHash:createHash('sha256').update('fixture').digest('hex')};

test('job claims are transactional, leased and idempotent',()=>{
 const db=new ProductionJobStore(':memory:');
 try{
  const one=db.claim(spec,1000,1000)!;
  assert.equal(one.record.status,'RUNNING');
  assert.equal(db.claim(spec,1000,1200),null);
  assert.equal(db.heartbeat(spec,one.owner,1000,1500),true);
  assert.equal(db.claim(spec,1000,1800),null);
  assert.equal(db.claim(spec,1000,2501)?.record.attempts,2);
  assert.throws(()=>db.succeed(spec,one.owner,spec.inputHash,2600),/ownership/);
  assert.equal(db.claim(spec,1000,2700),null);
 }finally{db.close();}
});

test('completed job stays completed and retryable failures can be reclaimed',()=>{
 const db=new ProductionJobStore(':memory:');
 try{
  const one=db.claim(spec,1000,1000)!;
  db.fail(spec,one.owner,'provider temporarily offline',true,1200);
  assert.equal(db.get(spec)!.status,'RETRYABLE_FAILED');
  const two=db.claim(spec,1000,1300)!;
  db.succeed(spec,two.owner,spec.inputHash,1350);
  assert.equal(db.claim(spec,1000,1500),null);
  assert.equal(db.get(spec)!.output_hash,spec.inputHash);
  assert.equal(db.list('EP0001').length,1);
  assert.equal(jobKey(spec).length,64);
 }finally{db.close();}
});

test('invalid job specification and stale lease are rejected',()=>{
 const db=new ProductionJobStore(':memory:');
 try {
   assert.throws(()=>jobKey({...spec,inputHash:'bad'}),/SHA-256/);
   const a=db.claim(spec,1000,1000)!;
   assert.equal(db.heartbeat(spec,a.owner,1000,2002),false);
   assert.throws(()=>db.succeed(spec,a.owner,spec.inputHash,2002),/ownership/);
 }finally{db.close();}
});
