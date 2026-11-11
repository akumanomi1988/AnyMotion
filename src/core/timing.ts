/** Canonical episode times are integer milliseconds. Frame conversion is an output concern. */
export function frameTimeMs(frame: number, fps: number): number {
  if (!Number.isSafeInteger(frame) || frame < 0 || !Number.isFinite(fps) || fps <= 0) throw new RangeError('Invalid frame or FPS');
  return Math.round(frame * 1000 / fps);
}

export function frameCount(durationMs: number, fps: number): number {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || !Number.isFinite(fps) || fps <= 0) throw new RangeError('Invalid duration or FPS');
  const count = durationMs * fps / 1000;
  if (!Number.isSafeInteger(count)) throw new RangeError(`Duration ${durationMs}ms is not frame-aligned at ${fps} fps`);
  return count;
}

export function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
export function easeInOut(value: number): number { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); }
