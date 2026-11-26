import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { run } from "../engines/run.js";

/**
 * Always skipped, regardless of .hagstoneignore / .vigilignore: dependencies, build output and
 * tool caches. None of it is the project's own source, and framework build output (`.next/`) holds
 * minified bundles and generated keys that only produce noise.
 */
export const DEFAULT_IGNORES = [
  "node_modules/", ".git/", "dist/", "build/", "vendor/", ".venv/", "venv/", "__pycache__/", ".hagstone/",
  ".next/", ".nuxt/", ".output/", ".svelte-kit/", ".turbo/", ".vercel/", ".netlify/", ".parcel-cache/",
  ".angular/", ".cache/", "coverage/", ".nyc_output/", ".pytest_cache/", ".mypy_cache/", ".ruff_cache/", ".tox/",
];

/**
 * Load .hagstoneignore from the scan root, or from `file` when given (CI passes the base branch's copy,
 * so a pull request can't hide its own code by editing the ignore file). Each non-comment line is
 * either a path prefix ("bench/cases/") or a bare directory/file name ("fixtures") that matches at
 * any depth. A missing file means no patterns.
 */
export const IGNORE_FILE = ".hagstoneignore";
/** Read when .hagstoneignore is absent (the tool was called Vigil before 0.2.0). */
export const LEGACY_IGNORE_FILE = ".vigilignore";

export async function loadIgnorePatterns(root: string, file?: string): Promise<string[]> {
  let text = "";
  for (const candidate of file ? [file] : [join(root, IGNORE_FILE), join(root, LEGACY_IGNORE_FILE)]) {
    try {
      text = await readFile(candidate, "utf8");
      break;
    } catch {
      // No ignore file is fine.
    }
  }
  const own = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  return [...DEFAULT_IGNORES, ...own];
}

export function isIgnored(relPath: string, patterns: string[]): boolean {
  const path = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
  const segments = path.split("/");
  return patterns.some((raw) => {
    // A leading "/" anchors the pattern to the scan root: "/out/" is that directory, "/notes.md" that file.
    if (raw.startsWith("/")) {
      const q = raw.slice(1);
      return q.endsWith("/") ? path.startsWith(q) : path === q || path.startsWith(`${q}/`);
    }
    const p = raw.replace(/^\.\//, "");
    if (p.includes("/") && !/^[^/]+\/$/.test(p)) return path.startsWith(p);
    const name = p.replace(/\/$/, "");
    return segments.includes(name);
  });
}

/**
 * Files git ignores and doesn't track, as root-anchored patterns ("/.env.local", "/.next/"). They are
 * never committed (local env files, build output, caches), so a scan of the repo skips them. Tracked
 * files are never listed, even when a .gitignore rule matches them, so .gitignore can't hide
 * committed code. Empty when `root` isn't in a git work tree or git isn't installed.
 */
export async function gitIgnoredPatterns(root: string): Promise<string[]> {
  try {
    const res = await run(
      "git",
      // fsmonitor and the untracked cache are repo config that can run commands or go stale: off.
      ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", "ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"],
      { cwd: root, timeoutMs: 30_000 },
    );
    if (res.code !== 0) return [];
    return res.stdout
      .split("\0")
      .filter((p) => p && !p.startsWith("../"))
      .map((p) => `/${p}`);
  } catch {
    return [];
  }
}
