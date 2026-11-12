import type { CharacterId, DialogueLine, Episode } from './contracts.js';
import { allDialogue } from './contracts.js';

export function formatSrtTime(ms: number): string {
  if (!Number.isSafeInteger(ms) || ms < 0) throw new RangeError('SRT time must be a nonnegative integer in milliseconds');
  const hours = Math.floor(ms / 3600000).toString().padStart(2, '0');
  const minutes = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
  const seconds = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds},${(ms % 1000).toString().padStart(3, '0')}`;
}

export function serializeSrt(lines: readonly DialogueLine[], includeSpeaker = false): string {
  return [...lines].sort((a, b) => a.startMs - b.startMs || a.lineId.localeCompare(b.lineId))
    .map((line, i) => `${i + 1}\n${formatSrtTime(line.startMs)} --> ${formatSrtTime(line.endMs)}\n${includeSpeaker ? `${line.characterId === 'vera' ? 'Vera' : 'Leo'}: ` : ''}${line.text.trim().replace(/\r?\n/g, ' ')}\n`)
    .join('\n');
}

export function createSubtitles(episode: Episode): Record<CharacterId | 'combined', string> {
  const lines = allDialogue(episode);
  return {
    vera: serializeSrt(lines.filter(l => l.characterId === 'vera')),
    leo: serializeSrt(lines.filter(l => l.characterId === 'leo')),
    combined: serializeSrt(lines, true),
  };
}
