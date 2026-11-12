import test from 'node:test';
import assert from 'node:assert/strict';
import {createNineMinuteLoadFixture} from '../tools/load-fixture.js';
import {frameCount} from '../core/timing.js';
import {renderSvgFrame} from '../renderer/scene.js';

test('synthetic target-length technical fixture spans 9min/54 scenes/3 sets',()=>{
 const ep=createNineMinuteLoadFixture();
 assert.equal(ep.durationMs,540000);
 assert.equal(ep.scenes.length,54);
 assert.equal(new Set(ep.scenes.map(s=>s.setId)).size,3);
 assert.equal(frameCount(ep.durationMs,30),16200);
 assert.equal(ep.scenes.flatMap(s=>s.dialogue).length,108);
 assert.match(renderSvgFrame(ep,16199,30,1920,1080),/<svg/);
});
