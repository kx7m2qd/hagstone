import { stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint, SEVERITY_ORDER, VULNERABLE_DEPENDENCY, type Finding, type Severity } from "../core/finding.js";
import { cacheRoot } from "./install.js";
import { addManifestLines } from "./manifest-lines.js";
import { toRelative } from "./paths.js";
import { run } from "./run.js";
import type { EngineOutput } from "./types.js";

interface OsvVuln {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  affected?: {
    package?: { name?: string; ecosystem?: string };
    ranges?: { events?: { introduced?: string; fixed?: string }[] }[];
  }[];
  database_specific?: { severity?: string; cwe_ids?: string[] };
}

interface OsvPackage {
  package: { name: string; version: string; ecosystem: string };
  vulnerabilities?: OsvVuln[];
  groups?: { ids: string[]; aliases?: string[]; max_severity?: string }[];
}

export interface OsvOutput {
  results?: { source: { path: string; type: string }; packages?: OsvPackage[] }[];
}

const CONFIG = fileURLToPath(new URL("../../config/osv-scanner.toml", import.meta.url));

export function severityFromScore(score: string | undefined, label: string | undefined): Severity {
  const n = score ? Number.parseFloat(score) : Number.NaN;
  if (!Number.isNaN(n) && n > 0) {
    if (n >= 9) return "critical";
    if (n >= 7) return "high";
    if (n >= 4) return "medium";
    return "low";
  }
  switch (label?.toUpperCase()) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "LOW":
      return "low";
    default:
      return "medium";
  }
}

/** Fixed versions this advisory lists for this package (one per affected release line). */
function fixesFor(v: OsvVuln, pkg: OsvPackage["package"]): string[] {
  const fixed = new Set<string>();
  for (const a of v.affected ?? []) {
    if (a.package?.name !== pkg.name) continue;
    for (const r of a.ranges ?? []) for (const e of r.events ?? []) if (e.fixed) fixed.add(e.fixed);
  }
  return [...fixed];
}

/**
 * Order two version strings by their numeric release part (`1.2.10` > `1.2.9`), with a
 * pre-release (`2.0.0-rc.1`, `2.0.0b1`) before its release. Good enough for npm and PyPI.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const m = /^v?(\d+(?:\.\d+)*)(.*)$/.exec(v.trim());
    return { nums: (m?.[1] ?? "0").split(".").map(Number), pre: !!m?.[2] && !/^\+/.test(m[2]) && !/^\.post/i.test(m[2]) };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d) return d;
  }
  return Number(y.pre) - Number(x.pre);
}

/**
 * The lowest version that fixes every advisory: for each one, its first fix above the installed
 * version; then the highest of those. Advisories with no such fix are counted, not guessed.
 */
export function upgradeTarget(version: string, fixesPerAdvisory: string[][]): { target?: string; unfixed: number } {
  let target: string | undefined;
  let unfixed = 0;
  for (const fixes of fixesPerAdvisory) {
    const above = fixes.filter((f) => compareVersions(f, version) > 0).sort(compareVersions)[0];
    if (!above) {
      unfixed++;
      continue;
    }
    if (!target || compareVersions(above, target) > 0) target = above;
  }
  return { target, unfixed };
}

const MAX_LISTED = 5;

/**
 * One finding per package version, listing every advisory against it (osv already merges aliases
 * like GHSA + CVE into groups) and the single upgrade that fixes them all. One row per advisory
 * turned one outdated package into 10-30 findings nobody reads.
 */
export function normalizeOsv(root: string, out: OsvOutput): Finding[] {
  const findings: Finding[] = [];
  for (const result of out.results ?? []) {
    const path = toRelative(root, result.source.path);
    for (const pkg of result.packages ?? []) {
      const vulns = pkg.vulnerabilities ?? [];
      const groups = pkg.groups?.length ? pkg.groups : vulns.map((v) => ({ ids: [v.id], aliases: v.aliases }));
      const { name, version, ecosystem } = pkg.package;
      const advisories = [...new Set(groups.flatMap((g) => [...g.ids, ...(g.aliases ?? [])]))].sort();
      if (!groups.length) continue;
      // OpenSSF malicious-package advisories: the package itself is the attack, not a bug in it.
      const mal = advisories.filter((a) => a.startsWith("MAL-"));
      if (mal.length) {
        findings.push({
          id: fingerprint("osv-scanner", "pkg-known-malicious", path, ecosystem, name),
          category: "dependency",
          engine: "osv-scanner",
          ruleId: "pkg-known-malicious",
          title: `Known malicious package: ${name}`,
          message: `${name}@${version} (${ecosystem}) is listed as malicious (${mal.join(", ")}). It was published to steal data or run attacker code. Remove it, rotate any secrets that were reachable where it was installed, and install the legitimate package if you meant a different one.`,
          severity: "critical",
          confidence: "high",
          location: { path, startLine: 1 },
          cwe: ["CWE-506"],
          owasp: ["A08:2021 - Software and Data Integrity Failures"],
          dependency: { name, version, ecosystem, advisories, fixedVersions: [] },
        });
        continue;
      }
      const entries = groups
        .map((g) => {
          const members = vulns.filter((v) => g.ids.includes(v.id));
          const primary = members[0];
          return {
            id: g.ids[0] ?? "unknown",
            summary: primary?.summary,
            severity: severityFromScore("max_severity" in g ? g.max_severity : undefined, primary?.database_specific?.severity),
            fixes: [...new Set(members.flatMap((m) => fixesFor(m, pkg.package)))],
            cwes: members.flatMap((m) => m.database_specific?.cwe_ids ?? []),
          };
        })
        .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.id.localeCompare(b.id));
      const worst = entries[0]!;
      const { target, unfixed } = upgradeTarget(version, entries.map((e) => e.fixes));
      const n = entries.length;
      const fix = target
        ? ` Upgrade to ${target} or later to fix ${unfixed ? `${n - unfixed} of them; ${unfixed} ${unfixed === 1 ? "has" : "have"} no fixed version yet` : n === 1 ? "it" : `all ${n}`}.`
        : ` No fixed version published yet.`;
      const listed = entries.slice(0, MAX_LISTED).map((e) => `${e.id} (${e.severity}${e.summary ? `: ${e.summary}` : ""})`);
      const more = n > MAX_LISTED ? `; and ${n - MAX_LISTED} more` : "";
      findings.push({
        id: fingerprint("osv-scanner", VULNERABLE_DEPENDENCY, path, ecosystem, name, version),
        category: "dependency",
        engine: "osv-scanner",
        ruleId: VULNERABLE_DEPENDENCY,
        title: n === 1 ? `${name} ${version}: ${worst.summary ?? worst.id}` : `${name} ${version} has ${n} known vulnerabilities`,
        message: `${name}@${version} (${ecosystem}) is affected by ${n === 1 ? "" : `${n} advisories: `}${listed.join("; ")}${more}.${fix}`,
        severity: worst.severity,
        location: { path, startLine: 1 },
        cwe: [...new Set(entries.flatMap((e) => e.cwes))],
        owasp: ["A06:2021 - Vulnerable and Outdated Components"],
        dependency: { name, version, ecosystem, advisories, fixedVersions: target ? [target] : [] },
      });
    }
  }
  return findings;
}

/** Where `hagstone offline-db` keeps OSV's per-ecosystem databases for `--offline` scans. */
export const OSV_DB_DIR = () => join(cacheRoot(), "osv-db");
/** Warn when an offline database is older than this. */
const STALE_DAYS = 7;

const baseArgs = [
  "scan",
  "source",
  "--format=json",
  // Our config, not the repo's osv-scanner.toml (which can ignore vulnerabilities).
  `--config=${CONFIG}`,
  // No call analysis: for some ecosystems it runs the repo's build scripts.
  "--no-call-analysis=all",
  // No transitive resolution: a manifest (e.g. pom.xml <repositories>) could
  // otherwise point the scanner at servers the repo chooses.
  "--no-resolve",
];

/** Ecosystems osv-scanner had no offline database for (it then reports nothing for them, exit 0). Pure. */
export function missingOfflineDbs(stderr: string): string[] {
  return [...new Set([...stderr.matchAll(/could not load db for (\S+) ecosystem/g)].map((m) => m[1]!))];
}

/** Offline databases osv-scanner loaded: ecosystem → file. Pure. */
export function loadedOfflineDbs(stderr: string): Map<string, string> {
  return new Map([...stderr.matchAll(/Loaded (\S+) local db from (.+)$/gm)].map((m) => [m[1]!, m[2]!.trim()]));
}

const OFFLINE_DB_HINT = "Run `hagstone offline-db` once with network access, or scan without --offline.";

export async function runOsv(bin: string, root: string, opts: { offline?: boolean } = {}): Promise<EngineOutput> {
  // Online: package names and versions go to the OSV API, never source code.
  // Offline: matched against databases downloaded earlier by `hagstone offline-db`; nothing is sent.
  const res = await run(
    bin,
    [...baseArgs, ...(opts.offline ? ["--offline", "--offline-vulnerabilities"] : []), "-r", "--", "."],
    { cwd: root, ...(opts.offline ? { env: { OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY: OSV_DB_DIR() } } : {}) },
  );
  // Without a database osv-scanner reports no vulnerabilities (sometimes with exit 0). That must not pass.
  const missing = opts.offline ? missingOfflineDbs(res.stderr) : [];
  if (missing.length) throw new Error(`no offline vulnerability database for ${missing.join(", ")}. ${OFFLINE_DB_HINT}`);
  // 0 = clean, 1 = vulnerabilities found, 128 = no packages/lockfiles found.
  if (res.code === 128) return { findings: [], warnings: [] };
  if (res.code !== 0 && res.code !== 1) {
    throw new Error(`osv-scanner exited ${res.code}: ${res.stderr.trim().slice(0, 500)}`);
  }
  const warnings: string[] = [];
  if (opts.offline) {
    for (const [eco, file] of loadedOfflineDbs(res.stderr)) {
      const mtime = await stat(file).then((s) => s.mtimeMs).catch(() => undefined);
      const days = mtime === undefined ? 0 : Math.floor((Date.now() - mtime) / 86_400_000);
      if (days >= STALE_DAYS)
        warnings.push(`osv-scanner: the offline ${eco} vulnerability database is ${days} days old; run \`hagstone offline-db\` to update it`);
    }
  }
  const findings = normalizeOsv(root, JSON.parse(res.stdout) as OsvOutput);
  await addManifestLines(root, findings);
  return { findings, warnings };
}

/**
 * Download (or refresh) OSV's database for every ecosystem the project at `root` uses, for later
 * `--offline` scans. Sends nothing about the project: whole-ecosystem archives are downloaded.
 */
export async function downloadOfflineDbs(bin: string, root: string): Promise<{ ecosystems: string[]; dir: string }> {
  const dir = OSV_DB_DIR();
  const res = await run(bin, [...baseArgs, "--offline-vulnerabilities", "--download-offline-databases", "-r", "--", "."], {
    cwd: root,
    env: { OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY: dir },
  });
  if (res.code === 128) return { ecosystems: [], dir };
  const missing = missingOfflineDbs(res.stderr);
  if ((res.code !== 0 && res.code !== 1) || missing.length) {
    throw new Error(`osv-scanner couldn't download the vulnerability database${missing.length ? ` for ${missing.join(", ")}` : ""}: ${res.stderr.trim().slice(-500)}`);
  }
  return { ecosystems: [...loadedOfflineDbs(res.stderr).keys()].sort(), dir };
}
