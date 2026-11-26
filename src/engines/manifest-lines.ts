import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Finding } from "../core/finding.js";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A regex for a package name as it appears in a manifest or lockfile of its ecosystem. */
function namePattern(name: string, ecosystem: string): RegExp {
  // Maven names are `group:artifact`; files spell the artifact on its own (`<artifactId>`, Gradle `g:a:v`).
  const bare = ecosystem === "Maven" && name.includes(":") ? name.slice(name.lastIndexOf(":") + 1) : name;
  // PyPI treats `-`, `_` and `.` as the same and ignores case (PEP 503).
  const pypi = ecosystem === "PyPI";
  const body = pypi ? bare.split(/[-_.]+/).map(escape).join("[-_.]+") : escape(bare);
  // Not part of a longer name. `node_modules/<name>` is allowed, `@types/<name>` is not.
  return new RegExp(`(?:(?<=node_modules/)|(?<![A-Za-z0-9_.@/-]))${body}(?![A-Za-z0-9_./-])`, pypi ? "i" : "");
}

/**
 * The 1-based line that declares `name` at `version` in a manifest or lockfile, or undefined.
 * Prefers a line naming the package with the version on it or within the next three lines
 * (package-lock `"node_modules/x": {` then `"version"`, pom `<artifactId>` then `<version>`), then
 * the first line naming the package. Pure.
 */
export function packageLine(text: string, name: string, version: string, ecosystem: string): number | undefined {
  const lines = text.split("\n");
  const nameRe = namePattern(name, ecosystem);
  const versionRe = version ? new RegExp(`(?<![0-9A-Za-z.])v?${escape(version)}(?![0-9A-Za-z.])`) : undefined;
  let first: number | undefined;
  for (let i = 0; i < lines.length; i++) {
    if (!nameRe.test(lines[i]!)) continue;
    first ??= i + 1;
    if (!versionRe) break;
    for (let j = i; j < Math.min(lines.length, i + 4); j++) if (versionRe.test(lines[j]!)) return i + 1;
  }
  return first;
}

/** Lockfiles can be large; past this, the finding keeps line 1. */
const MAX_BYTES = 50 * 1024 * 1024;

/** Point each dependency finding at the line that declares its package. Files are read, never run. */
export async function addManifestLines(root: string, findings: Finding[]): Promise<void> {
  const texts = new Map<string, Promise<string | undefined>>();
  const read = (path: string) => {
    let t = texts.get(path);
    if (!t) {
      const abs = join(root, path);
      t = stat(abs)
        .then((s) => (s.isFile() && s.size <= MAX_BYTES ? readFile(abs, "utf8") : undefined))
        .catch(() => undefined);
      texts.set(path, t);
    }
    return t;
  };
  await Promise.all(
    findings.map(async (f) => {
      if (!f.dependency || f.location.path.startsWith("../")) return;
      const text = await read(f.location.path);
      const line = text && packageLine(text, f.dependency.name, f.dependency.version, f.dependency.ecosystem);
      if (line) f.location = { ...f.location, startLine: line };
    }),
  );
}
