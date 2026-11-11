import { resolve, relative, sep, isAbsolute } from 'node:path';
/** Keep all output paths inside a managed root, including on Windows cross-volume paths. */
export function withinRoot(root: string, target: string): string {
  const absoluteRoot = resolve(root);
  const absolute = resolve(absoluteRoot, target);
  const rel = relative(absoluteRoot, absolute);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('Refusing path outside managed root');
  }
  return absolute;
}
