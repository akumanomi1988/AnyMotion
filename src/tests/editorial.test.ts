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

test('original nine-minute draft and cultural localization preserve stable dialogue identities',async()=>{
 const ep=validateEpisode(JSON.parse(await readFile('examples/episode-0002-editorial-draft.json','utf8')) as unknown);
 const en=JSON.parse(await readFile('examples/episode-0002.en-US-editorial-draft.json','utf8')) as {episodeId:string;locale:string;lines:Record<string,string>};
 assert.equal(ep.episodeId,'EP0002');
 assert.equal(ep.durationMs,540000);
 assert.equal(ep.scenes.length,10);
 assert.equal(ep.scenes.flatMap(s=>s.dialogue).length,90);
 assert.equal(en.episodeId,ep.episodeId);assert.equal(en.locale,'en-US');
 assert.deepEqual(Object.keys(en.lines).sort(),ep.scenes.flatMap(s=>s.dialogue.map(d=>d.lineId)).sort());
 assert.equal(analyzeEditorial(ep).status,'HUMAN_REVIEW_REQUIRED');
 assert.equal(analyzeEditorial(ep).findings.some(f=>f.id==='DURATION'),false);
});
