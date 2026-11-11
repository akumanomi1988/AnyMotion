import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateEpisode, EpisodeValidationError, type Episode } from '../core/contracts.js';
import { createSubtitles, formatSrtTime, serializeSrt } from '../core/subtitles.js';
import { frameCount, frameTimeMs } from '../core/timing.js';
import { renderSvgFrame } from '../renderer/scene.js';
import { withinRoot } from '../core/filenames.js';

const pilotPromise: Promise<Episode> = readFile('examples/pilot.json', 'utf8').then(json => validateEpisode(JSON.parse(json) as unknown));

test('pilot fixture is a valid 78s episode with two scenes', async () => {
  const pilot = await pilotPromise;
  assert.equal(pilot.durationMs, 78000);
  assert.equal(pilot.scenes.length, 2);
  assert.equal(pilot.scenes.reduce((total, s) => total + s.dialogue.length, 0), 14);
});

test('unknown LLM actions are rejected', async () => {
  const pilot = structuredClone(await pilotPromise) as unknown as Record<string, any>;
  pilot.scenes[0].actions[0].type = 'eval';
  assert.throws(() => validateEpisode(pilot), EpisodeValidationError);
});

test('undocumented fields are rejected', async () => {
  const pilot = structuredClone(await pilotPromise) as unknown as Record<string, any>;
  pilot.scenes[0].dialogue[0].execute = 'rm -rf';
  assert.throws(() => validateEpisode(pilot), /unknown property execute/);
});

test('missing assets are rejected', async () => {
  const pilot = structuredClone(await pilotPromise) as unknown as Record<string, any>;
  pilot.scenes[1].setId = 'unknown-room';
  assert.throws(() => validateEpisode(pilot), /not registered/);
});

test('scene timeline gaps and out-of-bound lines fail', async () => {
  const pilot = structuredClone(await pilotPromise) as unknown as Record<string, any>;
  pilot.scenes[1].startMs += 100;
  pilot.scenes[1].dialogue[0].endMs = 79000;
  assert.throws(() => validateEpisode(pilot), /startMs|timing invalid/);
});

test('SRT uses absolute timestamps and never leaks other characters', async () => {
  const { vera, leo, combined } = createSubtitles(await pilotPromise);
  assert.match(vera, /00:00:05,350 --> 00:00:07,800/);
  assert.doesNotMatch(vera, /He resuelto el problema/);
  assert.match(leo, /He resuelto el problema/);
  assert.doesNotMatch(leo, /¿Qué problema\?/);
  assert.match(combined, /Leo: He resuelto/);
  assert.match(combined, /Vera: ¿Qué problema\?/);
  assert.equal(vera.match(/ --> /g)?.length, 7);
  assert.equal(leo.match(/ --> /g)?.length, 7);
});

test('SRT overlap between different speakers is preserved', () => {
  const lines = [
    { lineId: 'DL01', characterId: 'vera' as const, text: 'Hola', startMs: 1000, endMs: 3500 },
    { lineId: 'DL02', characterId: 'leo' as const, text: 'Sí', startMs: 2200, endMs: 2800 },
  ];
  const rendered = serializeSrt(lines);
  assert.match(rendered, /00:00:01,000 --> 00:00:03,500/);
  assert.match(rendered, /00:00:02,200 --> 00:00:02,800/);
});

test('SRT time formatting is precise', () => {
  assert.equal(formatSrtTime(3723003), '01:02:03,003');
  assert.throws(() => formatSrtTime(-2), RangeError);
});

test('frame arithmetic is exact and refuses non frame-aligned durations', () => {
  assert.equal(frameCount(78000, 12), 936);
  assert.equal(frameCount(78000, 30), 2340);
  assert.equal(frameTimeMs(30, 30), 1000);
  assert.throws(() => frameCount(1234, 30), RangeError);
});

test('renderer is pure for a given episode/frame and has no burnt subtitles', async () => {
  const pilot = await pilotPromise;
  const a = renderSvgFrame(pilot, 120, 12, 640, 360);
  assert.equal(a, renderSvgFrame(pilot, 120, 12, 640, 360));
  assert.match(a, /<svg/);
  assert.match(a, /viewBox=/);
  assert.doesNotMatch(a, /He resuelto el problema/);
  assert.throws(() => renderSvgFrame(pilot, 936, 12, 640, 360), RangeError);
});

test('camera cuts change framing at defined frame', async () => {
  const pilot = await pilotPromise;
  const wide = renderSvgFrame(pilot, 0, 12, 640, 360);
  const close = renderSvgFrame(pilot, 400, 12, 640, 360);
  assert.match(wide, /viewBox="0 0 1280 720"/);
  assert.match(close, /viewBox="555 185 530 298.125"/);
});

test('managed paths refuse traversal', () => {
  assert.throws(() => withinRoot('/tmp/studio', '../outside'), /outside managed root/);
  assert.equal(withinRoot('/tmp/studio', 'episodes/EP0001'), '/tmp/studio/episodes/EP0001');
});
