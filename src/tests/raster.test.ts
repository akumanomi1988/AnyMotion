import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {currentRendererBackend,rasterizeSvgFrame,sharpAvailability} from '../renderer/raster.js';
import {renderSvgFrame} from '../renderer/scene.js';
import {validateEpisode} from '../core/contracts.js';
import {readFile} from 'node:fs/promises';
const episode=validateEpisode(JSON.parse(await readFile('examples/pilot.json','utf8')) as unknown);

test('sharp rasterization produces deterministic valid PNG frames with expected dimensions',async()=>{
 assert.match(sharpAvailability(),/libvips/);
 assert.equal(currentRendererBackend(),'sharp-png-v1');
 const svg=renderSvgFrame(episode,25,12,640,360);
 const a=await rasterizeSvgFrame(svg,640,360);
 const b=await rasterizeSvgFrame(svg,640,360);
 assert.equal(a.toString('hex'),b.toString('hex'));
 const info=await sharp(a).metadata();
 assert.equal(info.width,640);assert.equal(info.height,360);assert.equal(info.format,'png');
 await assert.rejects(()=>rasterizeSvgFrame(svg,1920,1080),/invalid PNG dimensions/);
 await assert.rejects(()=>rasterizeSvgFrame('<img/>',640,360),/Only a generated SVG/);
});
