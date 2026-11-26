import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const realRoots = new Map<string, string>();

/** The root with symlinks resolved (macOS `/var` → `/private/var`, a symlinked checkout). */
function realRoot(root: string): string {
  let real = realRoots.get(root);
  if (real === undefined) {
    try {
      real = realpathSync.native(root);
    } catch {
      real = root;
    }
    realRoots.set(root, real);
  }
  return real;
}

/**
 * Engine-reported path → path relative to the scan root, with forward slashes. Some engines
 * (osv-scanner) report the real path of a file, so an absolute path outside the root is retried
 * against the root's real path before it's given up as `../…`.
 */
export function toRelative(root: string, enginePath: string): string {
  let rel = relative(root, resolve(root, enginePath));
  if (isAbsolute(enginePath) && (rel === ".." || rel.startsWith(`..${sep}`))) {
    const viaReal = relative(realRoot(root), enginePath);
    if (viaReal !== ".." && !viaReal.startsWith(`..${sep}`) && !isAbsolute(viaReal)) rel = viaReal;
  }
  return rel.split(sep).join("/");
}
