import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateEpisode} from '../core/contracts.js';
import {analyzeEditorial} from '../quality/editorial.js';
import {createNineMinuteLoadFixture} from '../tools/load-fixture.js';
const pilot=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')) as unknown);
test('editorial report never silently approves a technical animation',()=>{
 const analysis=analyzeEditorial(pilot);
 assert.equal(analysis.status,'HUMAN_REVIEW_REQUIRED');
 assert(analysis.findings.some(f=>f.id==='DURATION'));
 assert(analysis.findings.some(f=>f.id==='HUMAN_EDITORIAL_QA'));
});
test('repetitive long synthetic episode is warned, never accepted as publishable comedy',()=>{
 const episode=createNineMinuteLoadFixture();
 const report=analyzeEditorial(episode);
 assert.equal(report.durationMs,540000);
 assert(report.findings.some(f=>f.id==='DIALOGUE_REPETITION'||f.id==='SCENE_VARIETY'||f.id==='STATIC_ACTING'));
 assert.equal(report.status,'HUMAN_REVIEW_REQUIRED');
});
test('rejects malformed prior summaries without losing contract validation',()=>{
 assert.throws(()=>analyzeEditorial(pilot,['x'.repeat(601)]),/Invalid prior/);
});
