import { resolve, relative, sep } from 'node:path';
/** Whitelist absolute filesystem targets against a managed output root. */
export function withinRoot(root: string, target: string): string {
  const absoluteRoot = resolve(root);
  const absolute = resolve(absoluteRoot, target);
  const rel = relative(absoluteRoot, absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(rel) === absolute && rel === '') throw new Error('Refusing path outside managed root');
  return absolute;
}
