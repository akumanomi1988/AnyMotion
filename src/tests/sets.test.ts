import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateEpisode} from '../core/contracts.js';
import {renderSvgFrame} from '../renderer/scene.js';

test('all three domestic sets validate and generate distinct deterministic SVGs',async()=>{
 const src=JSON.parse(await readFile('examples/pilot.json','utf8'));
 const outputs=new Set<string>();
 for(const id of ['living-room','kitchen','bedroom']){
  const ep=structuredClone(src);ep.scenes[0].setId=id;
  const valid=validateEpisode(ep);
  const svg=renderSvgFrame(valid,0,12,640,360);
  assert.equal(svg,renderSvgFrame(valid,0,12,640,360));
  assert.match(svg,/<svg/);
  outputs.add(svg);
 }
 assert.equal(outputs.size,3);
});
