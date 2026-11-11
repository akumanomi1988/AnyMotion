import type { Action, CameraShot, CharacterId, Episode, EpisodeScene, Expression, Gesture } from '../core/contracts.js';
import { findScene } from '../core/contracts.js';
import { clamp, easeInOut } from '../core/timing.js';

const palette = {
  cream: '#F4E7D7', dark: '#2D3035', oil: '#24565A', coral: '#E47C63',
  mustard: '#E8BC64', muted: '#8DA3A6', floor: '#D6BCA9', wall: '#F1E8DD',
};
const xml = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

type Pose = { expression: Expression; gesture: Gesture; gestureStrength: number; talking: boolean; blink: number; look: number; breathe: number; mouth: number };
function poseFor(scene: EpisodeScene, characterId: CharacterId, ms: number): Pose {
  const actions = scene.actions.filter(a => a.actorId === characterId && a.atMs <= ms).sort((a, b) => a.atMs - b.atMs);
  let expression: Expression = 'neutral';
  let gesture: Gesture = 'idle';
  let gestureStrength = 0;
  let look = characterId === 'vera' ? -0.35 : 0.35;
  for (const action of actions) {
    if (action.type === 'setExpression') expression = action.expression;
    if (action.type === 'lookAt') look = action.targetId === 'audience' ? 0 : action.targetId === 'vera' ? -1 : 1;
    if (action.type === 'gesture' && ms < action.atMs + action.durationMs) {
      gesture = action.gesture;
      const elapsed = ms - action.atMs;
      const envelope = Math.min(1, elapsed / 250, (action.durationMs - elapsed) / 350);
      gestureStrength = easeInOut(clamp(envelope, 0, 1));
    }
  }
  const talking = scene.dialogue.some(l => l.characterId === characterId && ms >= l.startMs && ms < l.endMs);
  const blinkCycle = (ms / 1000 + (characterId === 'vera' ? 0.1 : 1.7)) % 4.2;
  const blink = blinkCycle > 4.05 ? 0.08 : 1;
  return { expression, gesture, gestureStrength, talking, blink, look, breathe: Math.sin(ms / 700 + (characterId === 'leo' ? 1 : 0)) * 2.5, mouth: talking ? 2 + Math.abs(Math.sin(ms * 0.013 + (characterId === 'leo' ? 1 : 0))) * 9 : 1 };
}

function avatar(id: CharacterId, x: number, y: number, pose: Pose): string {
  const vera = id === 'vera';
  const shirt = vera ? palette.coral : palette.oil;
  const skin = vera ? '#E9AD8A' : '#D79B75';
  const pants = vera ? '#556776' : '#62677C';
  const hair = vera ? '#3A2F32' : '#49372C';
  const armSwing = pose.gesture === 'raiseHand' || pose.gesture === 'point' ? -76 * pose.gestureStrength : pose.gesture === 'shrug' ? -43 * pose.gestureStrength : 0;
  const otherArm = pose.gesture === 'shrug' ? 43 * pose.gestureStrength : pose.gesture === 'crossArms' ? -25 * pose.gestureStrength : 0;
  const brow = pose.expression === 'skeptical' ? -7 : pose.expression === 'surprised' ? -11 : pose.expression === 'annoyed' ? 5 : 0;
  const mouthPath = pose.talking ? `<ellipse cx="0" cy="-313" rx="8.3" ry="${pose.mouth.toFixed(1)}" fill="#613D36"/>` : pose.expression === 'happy' ? `<path d="M-13 -315 Q0 -299 13 -315" fill="none" stroke="#663D36" stroke-width="3.5" stroke-linecap="round"/>` : pose.expression === 'annoyed' ? `<path d="M-10 -309 Q0 -318 10 -309" fill="none" stroke="#663D36" stroke-width="3" stroke-linecap="round"/>` : `<path d="M-9 -312 Q0 -309 9 -312" fill="none" stroke="#663D36" stroke-width="3" stroke-linecap="round"/>`;
  const fingers = (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy}" r="12" fill="${skin}" stroke="#7E5850" stroke-width="1.6"/>`;
  return `<g transform="translate(${x} ${y + pose.breathe})">
    <ellipse cx="0" cy="3" rx="73" ry="16" fill="#5C4D4A" opacity=".20"/>
    <path d="M-45 -135 L-49 -16 Q-45 -7 -14 -10 L-8 -137Z" fill="${pants}"/>
    <path d="M8 -137 L14 -12 Q44 -5 49 -17 L44 -136Z" fill="${pants}"/>
    <path d="M-51 -18 Q-60 -2 -11 -1 L-8 -14Z M13 -14 L10 -2 Q64 0 52 -18Z" fill="#373D42"/>
    <path d="M-53 -280 Q-70 -251 -69 -145 Q0 -127 69 -145 Q71 -245 53 -280Z" fill="${shirt}" stroke="#26333B" stroke-width="2.5"/>
    <g transform="rotate(${otherArm.toFixed(1)} -48 -260)">
      <path d="M-46 -257 L-82 -216 L-88 -157" fill="none" stroke="${shirt}" stroke-width="30" stroke-linecap="round"/>
      ${fingers(-88, -157)}
    </g>
    <g transform="rotate(${armSwing.toFixed(1)} 46 -262)">
       <path d="M46 -260 L79 -218 L82 -164" fill="none" stroke="${shirt}" stroke-width="31" stroke-linecap="round"/>
       ${fingers(82, -164)}
    </g>
    <rect x="-16" y="-292" width="32" height="30" rx="11" fill="${skin}"/>
    ${vera ? `<path d="M-53 -392 Q-65 -375 -61 -296 Q-44 -277 -36 -305 L-37 -362Z M48 -390 Q65 -369 60 -296 Q48 -285 39 -303 L38 -365Z" fill="${hair}"/>` : ''}
    <ellipse cx="0" cy="-351" rx="55" ry="67" fill="${skin}" stroke="#8D6358" stroke-width="2"/>
    ${vera ? `<path d="M-54 -361 Q-61 -427 5 -425 Q60 -421 55 -358 Q36 -390 13 -390 Q-3 -366 -54 -361Z" fill="${hair}"/>` : `<path d="M-55 -362 Q-59 -427 -11 -421 Q7 -443 30 -423 Q64 -415 55 -366 Q37 -389 18 -391 Q0 -379 -19 -394 Q-34 -379 -55 -362Z" fill="${hair}"/>`}
    <g transform="translate(${(pose.look * 3).toFixed(2)} 0)">
      <ellipse cx="-21" cy="-348" rx="9" ry="${(9 * pose.blink).toFixed(2)}" fill="#FFF8F1"/>
      <ellipse cx="23" cy="-348" rx="9" ry="${(9 * pose.blink).toFixed(2)}" fill="#FFF8F1"/>
      <circle cx="${-20 + pose.look * 2.5}" cy="-348" r="4" fill="#2D3035"/>
      <circle cx="${22 + pose.look * 2.5}" cy="-348" r="4" fill="#2D3035"/>
    </g>
    <path d="M-34 ${-367 + brow} Q-23 ${-373 + brow} -10 -368" stroke="${hair}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M11 -369 Q23 ${-371 - brow * .5} 36 ${-370 - brow * .5}" stroke="${hair}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M0 -341 Q-6 -331 4 -329" stroke="#A86F5C" stroke-width="2.4" fill="none"/>
    ${mouthPath}
  </g>`;
}

function livingRoom(): string {
  return `<defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#F5EDE2"/><stop offset="1" stop-color="#EEE2D4"/></linearGradient>
    <linearGradient id="window" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#A8C9CF"/><stop offset="1" stop-color="#E0D4C1"/></linearGradient>
    <clipPath id="safe"><rect width="1280" height="720"/></clipPath>
  </defs>
  <rect width="1280" height="720" fill="url(#wall)"/>
  <rect y="536" width="1280" height="184" fill="${palette.floor}"/>
  <path d="M0 535 H1280" stroke="#BAA28F" stroke-width="9"/>
  <rect x="88" y="105" width="285" height="280" rx="12" fill="#FEFBF7" stroke="#D7C5B3" stroke-width="12"/>
  <rect x="103" y="121" width="257" height="250" fill="url(#window)"/>
  <path d="M230 121 V371 M103 233 H360" stroke="#FCF6EE" stroke-width="12"/>
  <path d="M106 303 Q152 259 205 298 Q250 251 360 306 V371 H103Z" fill="#8BA69E" opacity=".45"/>
  <path d="M82 103 Q112 193 95 387 M377 103 Q350 203 376 388" stroke="#D49E82" stroke-width="34" opacity=".55" fill="none"/>
  <rect x="840" y="105" width="162" height="121" rx="7" fill="#D4B49E"/>
  <rect x="853" y="118" width="136" height="95" fill="#F8F3EA"/>
  <path d="M866 187 Q900 132 929 170 Q956 132 977 179" stroke="${palette.oil}" stroke-width="9" fill="none"/>
  <rect x="955" y="339" width="273" height="21" rx="8" fill="#7A6255"/>
  <rect x="974" y="353" width="21" height="200" fill="#8E7562"/>
  <rect x="1177" y="353" width="21" height="200" fill="#8E7562"/>
  <path d="M990 337 V265 H1041 V336 M1073 337 V274 H1124 V337" fill="${palette.mustard}" stroke="#846E5B" stroke-width="3"/>
  <path d="M1141 336 V287 H1177 V336" fill="${palette.coral}"/>
  <rect x="470" y="397" width="348" height="140" rx="40" fill="#8DA5A5" stroke="#4C686C" stroke-width="5"/>
  <rect x="488" y="354" width="313" height="137" rx="35" fill="#759596" stroke="#4C686C" stroke-width="4"/>
  <rect x="469" y="395" width="45" height="145" rx="24" fill="#638587"/>
  <rect x="778" y="395" width="45" height="145" rx="24" fill="#638587"/>
  <path d="M480 548 L458 602 M808 548 L828 602" stroke="#5E4D48" stroke-width="14"/>
  <ellipse cx="640" cy="629" rx="258" ry="58" fill="#C49F88" opacity=".4"/>
  <ellipse cx="642" cy="618" rx="175" ry="28" fill="#CFB5A0"/>
  <path d="M618 616 L608 682 M668 616 L681 684" stroke="#826558" stroke-width="15"/>
  <path d="M1064 537 Q1021 475 1058 438 Q1090 453 1084 490 Q1124 440 1154 472 Q1152 510 1104 538" fill="none" stroke="#507F62" stroke-width="16" stroke-linecap="round"/>
  <path d="M1040 521 H1150 L1133 576 H1059Z" fill="#C07661"/>
  <rect x="46" y="478" width="50" height="60" rx="8" fill="${palette.mustard}"/>
  <path d="M71 480 V352" stroke="#5D6368" stroke-width="8"/>
  <path d="M30 355 L111 355 L98 291 L42 291Z" fill="#F4D5AC"/>
  `;
}

function cameraAt(scene: EpisodeScene, ms: number): CameraShot {
  let camera: CameraShot = scene.camera[0]!.shot;
  for (const cue of scene.camera) if (cue.atMs <= ms) camera = cue.shot;
  return camera;
}

function viewBox(shot: CameraShot): string {
  switch (shot) {
    case 'mediumVera': return '140 160 780 438.75';
    case 'mediumLeo': return '365 160 780 438.75';
    case 'closeVera': return '190 185 530 298.125';
    case 'closeLeo': return '555 185 530 298.125';
    case 'twoShot': return '80 68 1120 630';
    default: return '0 0 1280 720';
  }
}

/** Pure frame rendering. Same data, frame and renderer version produce equivalent SVG. */
export function renderSvgFrame(episode: Episode, frame: number, fps: number, width: number, height: number): string {
  const ms = Math.round(frame * 1000 / fps);
  if (ms < 0 || ms >= episode.durationMs) throw new RangeError('Frame outside episode');
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 160 || height < 90 || width / height !== 16 / 9) throw new RangeError('Render dimensions must be 16:9, >= 160x90');
  const scene = findScene(episode, ms);
  const shot = cameraAt(scene, ms);
  const actors = [avatar('vera', 347, 610, poseFor(scene, 'vera', ms)), avatar('leo', 924, 610, poseFor(scene, 'leo', ms))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox(shot)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${xml(episode.title)}">\n${livingRoom()}\n${actors.join('\n')}\n</svg>\n`;
}
