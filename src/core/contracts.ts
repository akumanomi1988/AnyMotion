/** Renderer-independent, strictly validated screenplay and timing contracts. */
export type CharacterId = 'vera' | 'leo';
export type Expression = 'neutral' | 'happy' | 'skeptical' | 'surprised' | 'annoyed' | 'thinking';
export type Gesture = 'raiseHand' | 'point' | 'crossArms' | 'shrug' | 'idle';
export type CameraShot = 'wide' | 'twoShot' | 'mediumVera' | 'mediumLeo' | 'closeVera' | 'closeLeo';
export type Action =
  | { id: string; type: 'setExpression'; actorId: CharacterId; expression: Expression; atMs: number }
  | { id: string; type: 'gesture'; actorId: CharacterId; gesture: Gesture; atMs: number; durationMs: number }
  | { id: string; type: 'lookAt'; actorId: CharacterId; targetId: CharacterId | 'audience'; atMs: number };
export interface DialogueLine {
  lineId: string;
  characterId: CharacterId;
  startMs: number;
  endMs: number;
  text: string;
}
export interface CameraCue { atMs: number; shot: CameraShot }
export interface EpisodeScene {
  sceneId: string;
  setId: 'living-room' | 'kitchen' | 'bedroom';
  startMs: number;
  endMs: number;
  camera: CameraCue[];
  actions: Action[];
  dialogue: DialogueLine[];
}
export interface Episode {
  schemaVersion: '1.0';
  episodeId: string;
  title: string;
  sourceLocale: 'es-ES';
  canvas: { width: number; height: number };
  fps: number;
  durationMs: number;
  scenes: EpisodeScene[];
}

export class EpisodeValidationError extends Error {
  constructor(readonly issues: string[]) { super(`Invalid episode:\n${issues.map(issue => `- ${issue}`).join('\n')}`); this.name = 'EpisodeValidationError'; }
}

const expressions: readonly string[] = ['neutral', 'happy', 'skeptical', 'surprised', 'annoyed', 'thinking'];
const gestures: readonly string[] = ['raiseHand', 'point', 'crossArms', 'shrug', 'idle'];
const shots: readonly string[] = ['wide', 'twoShot', 'mediumVera', 'mediumLeo', 'closeVera', 'closeLeo'];
const characters: readonly string[] = ['vera', 'leo'];
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(value);
const keys = (value: Record<string, unknown>, allow: readonly string[], where: string, issues: string[]): void => {
  for (const key of Object.keys(value)) if (!allow.includes(key)) issues.push(`${where}: unknown property ${key}`);
};

/** No arbitrary code, filesystem paths, prompt-invented props or unknown actions can reach the renderer. */
export function validateEpisode(value: unknown): Episode {
  const issues: string[] = [];
  if (!isObject(value)) throw new EpisodeValidationError(['root must be a JSON object']);
  keys(value, ['schemaVersion', 'episodeId', 'title', 'sourceLocale', 'canvas', 'fps', 'durationMs', 'scenes'], 'episode', issues);
  if (value.schemaVersion !== '1.0') issues.push('schemaVersion must be 1.0');
  if (!validId(value.episodeId)) issues.push('episodeId has an invalid identifier');
  if (typeof value.title !== 'string' || !value.title.trim()) issues.push('title must not be blank');
  if (value.sourceLocale !== 'es-ES') issues.push('sourceLocale must be es-ES in pilot');
  if (!isObject(value.canvas) || !Number.isSafeInteger(value.canvas.width) || !Number.isSafeInteger(value.canvas.height) || value.canvas.width !== 1280 || value.canvas.height !== 720) issues.push('canvas must be 1280x720 (world coordinates)');
  else keys(value.canvas, ['width', 'height'], 'canvas', issues);
  if (!Number.isSafeInteger(value.fps) || ![12, 24, 25, 30].includes(value.fps as number)) issues.push('fps must be 12, 24, 25 or 30');
  if (!validTime(value.durationMs) || value.durationMs < 1000 || value.durationMs > 600000) issues.push('durationMs must be between 1000 and 600000');
  const scenes = Array.isArray(value.scenes) ? value.scenes : [];
  if (!scenes.length || scenes.length > 100) issues.push('scenes count must be between 1 and 100');
  const sceneIds = new Set<string>();
  const actionIds = new Set<string>();
  const lineIds = new Set<string>();
  let expectedStart = 0;
  for (const [index, raw] of scenes.entries()) {
    const label = `scenes[${index}]`;
    if (!isObject(raw)) { issues.push(`${label} must be an object`); continue; }
    keys(raw, ['sceneId', 'setId', 'startMs', 'endMs', 'camera', 'actions', 'dialogue'], label, issues);
    if (!validId(raw.sceneId) || sceneIds.has(raw.sceneId)) issues.push(`${label}.sceneId is invalid or duplicate`);
    else sceneIds.add(raw.sceneId);
    if (!['living-room','kitchen','bedroom'].includes(raw.setId as string)) issues.push(`${label}.setId is not registered`);
    if (!validTime(raw.startMs) || raw.startMs !== expectedStart) issues.push(`${label}.startMs must equal ${expectedStart}`);
    if (!validTime(raw.endMs) || !validTime(raw.startMs) || raw.endMs <= raw.startMs || (validTime(value.durationMs) && raw.endMs > value.durationMs)) issues.push(`${label}.endMs outside valid scene interval`);
    if (validTime(raw.endMs)) expectedStart = raw.endMs;
    const camera = Array.isArray(raw.camera) ? raw.camera : [];
    if (!camera.length) issues.push(`${label} needs at least one camera cue`);
    let previousCameraMs = -1;
    for (const [c, cue] of camera.entries()) {
      if (!isObject(cue)) { issues.push(`${label}.camera[${c}] invalid`); continue; }
      keys(cue, ['atMs', 'shot'], `${label}.camera[${c}]`, issues);
      if (!shots.includes(cue.shot as string) || !validTime(cue.atMs) || cue.atMs < (raw.startMs as number) || cue.atMs >= (raw.endMs as number) || cue.atMs <= previousCameraMs) issues.push(`${label}.camera[${c}] invalid shot or cue timing`);
      if (validTime(cue.atMs)) previousCameraMs = cue.atMs;
    }
    if (isObject(camera[0]) && camera[0].atMs !== raw.startMs) issues.push(`${label} first camera cue must start at scene boundary`);
    const actions = Array.isArray(raw.actions) ? raw.actions : [];
    if (!Array.isArray(raw.actions)) issues.push(`${label}.actions must be an array`);
    for (const [a, action] of actions.entries()) {
      const loc = `${label}.actions[${a}]`;
      if (!isObject(action)) { issues.push(`${loc} invalid`); continue; }
      if (!validId(action.id) || actionIds.has(action.id)) issues.push(`${loc}.id invalid or duplicate`);
      else actionIds.add(action.id);
      if (!characters.includes(action.actorId as string)) issues.push(`${loc}.actorId is unknown`);
      if (!validTime(action.atMs) || action.atMs < (raw.startMs as number) || action.atMs >= (raw.endMs as number)) issues.push(`${loc}.atMs is outside scene`);
      if (action.type === 'setExpression') {
        keys(action, ['id', 'type', 'actorId', 'atMs', 'expression'], loc, issues);
        if (!expressions.includes(action.expression as string)) issues.push(`${loc}.expression is unknown`);
      } else if (action.type === 'gesture') {
        keys(action, ['id', 'type', 'actorId', 'atMs', 'gesture', 'durationMs'], loc, issues);
        if (!gestures.includes(action.gesture as string) || !validTime(action.durationMs) || action.durationMs === 0 || (action.atMs as number) + (action.durationMs as number) > (raw.endMs as number)) issues.push(`${loc}.gesture or duration invalid`);
      } else if (action.type === 'lookAt') {
        keys(action, ['id', 'type', 'actorId', 'atMs', 'targetId'], loc, issues);
        if (![...characters, 'audience'].includes(action.targetId as string)) issues.push(`${loc}.targetId unknown`);
      } else issues.push(`${loc}.type unknown`);
    }
    const dialogue = Array.isArray(raw.dialogue) ? raw.dialogue : [];
    if (!Array.isArray(raw.dialogue)) issues.push(`${label}.dialogue must be an array`);
    for (const [d, line] of dialogue.entries()) {
      const loc = `${label}.dialogue[${d}]`;
      if (!isObject(line)) { issues.push(`${loc} invalid`); continue; }
      keys(line, ['lineId', 'characterId', 'startMs', 'endMs', 'text'], loc, issues);
      if (!validId(line.lineId) || lineIds.has(line.lineId)) issues.push(`${loc}.lineId invalid or duplicate`);
      else lineIds.add(line.lineId);
      if (!characters.includes(line.characterId as string)) issues.push(`${loc}.characterId unknown`);
      if (!validTime(line.startMs) || !validTime(line.endMs) || line.startMs < (raw.startMs as number) || line.endMs > (raw.endMs as number) || line.endMs <= line.startMs) issues.push(`${loc} timing invalid`);
      if (typeof line.text !== 'string' || !line.text.trim() || line.text.length > 1000) issues.push(`${loc}.text invalid`);
    }
  }
  if (expectedStart !== value.durationMs) issues.push('scenes must cover the episode duration without gaps');
  if (issues.length) throw new EpisodeValidationError(issues);
  return value as unknown as Episode;
}

export function allDialogue(episode: Episode): DialogueLine[] {
  return episode.scenes.flatMap(scene => scene.dialogue).sort((a, b) => a.startMs - b.startMs || a.lineId.localeCompare(b.lineId));
}

export function findScene(episode: Episode, timeMs: number): EpisodeScene {
  const scene = episode.scenes.find(s => timeMs >= s.startMs && timeMs < s.endMs);
  if (!scene) throw new Error(`Frame time ${timeMs} is outside episode timeline`);
  return scene;
}
