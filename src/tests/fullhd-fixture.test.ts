import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateEpisode} from '../core/contracts.js';
import {renderSvgFrame} from '../renderer/scene.js';

test('24-second 1080p benchmark has speaking leads, actions and genuine camera framing changes',async()=>{
 const ep=validateEpisode(JSON.parse(await readFile('examples/benchmark-24.json','utf8')) as unknown);
 assert.equal(ep.episodeId,'EPBENCH24');assert.equal(ep.durationMs,24000);
 const scene=ep.scenes[0]!;
 assert(scene.actions.length>=2);
 assert(scene.camera.length>=2);
 assert.deepEqual(new Set(scene.dialogue.map(l=>l.characterId)),new Set(['vera','leo']));
 assert.match(renderSvgFrame(ep,0,30,1920,1080),/<svg/);
 assert.notEqual(renderSvgFrame(ep,0,30,1920,1080),renderSvgFrame(ep,Math.round(ep.durationMs/1000*30)-1,30,1920,1080));
});
