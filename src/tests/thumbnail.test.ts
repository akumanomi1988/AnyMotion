import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateEpisode} from '../core/contracts.js';
import {makeThumbnailSvg} from '../production/thumbnail.js';
const ep=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')) as unknown);
test('thumbnail frame is deterministic, original-size and independent of subtitle content',()=>{
 const a=makeThumbnailSvg(ep,12000),b=makeThumbnailSvg(ep,12000);
 assert.equal(a,b);assert.match(a,/<svg/);assert.match(a,/1280/);assert.match(a,/720/);
 assert.doesNotMatch(a,/-->.*SRT|combined\.srt|vera\.srt/);
 assert.throws(()=>makeThumbnailSvg(ep,-1),/outside/);
 assert.throws(()=>makeThumbnailSvg(ep,ep.durationMs),/outside/);
});
