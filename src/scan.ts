import { readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { applyBaseline, BASELINE_FILE, defaultBaselinePath, loadBaseline, today, type BaselineSummary } from "./core/baseline.js";
import { dedupe, sortFindings, type EngineName, type Finding } from "./core/finding.js";
import { DEFAULT_IGNORES, isIgnored, loadIgnorePatterns } from "./core/ignore.js";
import { pathScope } from "./core/scope.js";
import { runGitleaks } from "./engines/gitleaks.js";
import { runImageScan } from "./engines/grype.js";
import { overrideVar, resolveEngine } from "./engines/install.js";
import type { BinaryEngine } from "./engines/manifest.js";
import { runOpengrep } from "./engines/opengrep.js";
import { runOsv } from "./engines/osv.js";
import { runPkgrisk } from "./engines/pkgrisk/index.js";
import { LICENSE_POLICY_FILE, loadLicensePolicy, runSyftLicenses } from "./engines/syft.js";
import { runTrivy } from "./engines/trivy.js";
import type { EngineOutput } from "./engines/types.js";
import { applyReachability } from "./reachability/index.js";

export const ALL_ENGINES: EngineName[] = ["opengrep", "osv-scanner", "gitleaks", "pkgrisk", "trivy", "syft"];

export interface ScanOptions {
  engines?: EngineName[];
  autoInstall?: boolean;
  /** Turn off pkgrisk's registry lookups (the only network use of that engine). */
  offline?: boolean;
  /** Import-level reachability for vulnerable npm/PyPI dependencies (default: on). */
  reachability?: boolean;
  /** Drop findings judged unreachable instead of only lowering their severity. */
  reachableOnly?: boolean;
  /** Ignore patterns from this file instead of `<root>/.hagstoneignore` (missing file → none). */
  ignoreFile?: string;
  /** Report code and dependency findings in test and example paths too (default: hidden and counted). */
  includeTests?: boolean;
  /**
   * License policy to apply instead of `<root>/.hagstone/licenses.json` (missing or empty file →
   * defaults only). CI passes the base branch's copy so a PR can't allow the license it adds.
   */
  licensePolicy?: string;
  /** Report IaC hardening checks too (LOW and config/iac-hardening.json; default: hidden and counted). */
  includeHardening?: boolean;
  /** Baseline file to apply instead of `<root>/.hagstone/baseline.json` (missing file → none). */
  baseline?: string;
  /** Don't apply any baseline: report every finding. */
  noBaseline?: boolean;
  /**
   * The scan doesn't cover the whole tree (pre-commit hook, MCP `paths`), so baseline entries that
   * match nothing can't be called stale.
   */
  partial?: boolean;
}

export interface EngineStatus {
  engine: EngineName;
  ok: boolean;
  findings: number;
  ms: number;
  error?: string;
}

export interface ScanResult {
  root: string;
  findings: Finding[];
  /**
   * Patterns from the repo's own .hagstoneignore. Surfaced in every report: the repo
   * is untrusted, and a change here can hide findings.
   */
  ignores: string[];
  warnings: string[];
  engines: EngineStatus[];
  /** Findings left out because they are in test or example code (see `includeTests`). */
  hiddenInTests?: number;
  /** Findings a baseline entry hides, each with `suppression` set. Not in `findings`, not gated. */
  suppressed?: Finding[];
  /** Present when a baseline file was applied. */
  baseline?: BaselineSummary;
}

/**
 * Test and example code isn't deployed, so its code findings and its lockfiles' vulnerable packages
 * are noise by default. Secrets and malicious packages stay: a leaked key or an installed attack
 * package does harm wherever the file lives.
 */
export function hiddenByScope(f: Finding): boolean {
  if (!f.scope) return false;
  if (f.category === "code" || f.category === "iac" || f.category === "license") return true;
  return f.category === "dependency" && f.engine === "osv-scanner" && f.ruleId !== "pkg-known-malicious";
}

export async function scan(target: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const root = resolve(target);
  const ignores = await loadIgnorePatterns(root, opts.ignoreFile);
  const engines = opts.engines ?? ALL_ENGINES;
  const autoInstall = opts.autoInstall ?? true;

  const policyPath = opts.licensePolicy ? resolve(opts.licensePolicy) : join(root, LICENSE_POLICY_FILE);
  const license = engines.includes("syft") ? await loadLicensePolicy(policyPath) : undefined;

  const runners: Partial<Record<BinaryEngine, (bin: string) => Promise<EngineOutput>>> = {
    opengrep: (bin) => runOpengrep(bin, root, ignores),
    "osv-scanner": (bin) => runOsv(bin, root, { offline: opts.offline ?? false }),
    gitleaks: (bin) => runGitleaks(bin, root),
    syft: (bin) => runSyftLicenses(bin, root, ignores, { offline: opts.offline ?? false, policy: license!.policy }),
    trivy: (bin) => runTrivy(bin, root, ignores, { includeHardening: opts.includeHardening ?? false }),
  };

  const runnerFor = (engine: BinaryEngine) => {
    const r = runners[engine];
    if (!r) throw new Error(`${engine} doesn't scan a directory`);
    return r;
  };

  // Engines run in parallel; one failing engine must not hide the others' results.
  const outcomes = await Promise.all(
    engines.map(async (engine) => {
      const started = Date.now();
      try {
        // pkgrisk is built in: there is no binary to resolve.
        const out =
          engine === "pkgrisk"
            ? await runPkgrisk(root, ignores, { offline: opts.offline ?? false })
            : await runnerFor(engine)(await resolveEngine(engine, { autoInstall }));
        return { engine, out, ms: Date.now() - started };
      } catch (e) {
        return { engine, error: e instanceof Error ? e.message : String(e), ms: Date.now() - started };
      }
    }),
  );

  const findings: Finding[] = [];
  const warnings: string[] = [];
  for (const engine of engines) {
    if (engine === "pkgrisk") continue;
    const v = overrideVar(engine);
    if (process.env[v]) warnings.push(`${engine}: using ${v}=${process.env[v]}, which is not checksum-verified`);
  }
  if (license?.error) warnings.push(`license policy ${relative(root, policyPath) || policyPath} not applied (${license.error}); using the defaults`);
  const statuses: EngineStatus[] = [];
  for (const o of outcomes) {
    if ("error" in o) {
      statuses.push({ engine: o.engine, ok: false, findings: 0, ms: o.ms, error: o.error });
      warnings.push(`${o.engine} failed: ${o.error}`);
      continue;
    }
    const kept = o.out.findings.filter((f) => !isIgnored(f.location.path, ignores));
    findings.push(...kept);
    warnings.push(...o.out.warnings);
    statuses.push({ engine: o.engine, ok: true, findings: kept.length, ms: o.ms });
  }

  let kept = dedupe(findings);
  for (const f of kept) {
    const where = pathScope(f.location.path);
    if (where !== "prod") f.scope = where;
  }
  const visible = opts.includeTests ? kept : kept.filter((f) => !hiddenByScope(f));
  const hiddenScope = opts.includeTests ? [] : kept.filter((f) => hiddenByScope(f));
  const hiddenInTests = hiddenScope.length;
  kept = visible;
  if (opts.reachability ?? true) {
    try {
      await applyReachability(root, kept, ignores);
    } catch (e) {
      // Reachability only refines findings; a failure must never drop or block them.
      warnings.push(`reachability analysis failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  let suppressed: Finding[] | undefined;
  let baseline: BaselineSummary | undefined;
  if (!opts.noBaseline) {
    const path = opts.baseline ? resolve(opts.baseline) : defaultBaselinePath(root);
    const rel = relative(root, path);
    const shown = !opts.baseline ? BASELINE_FILE : rel && !rel.startsWith("..") ? rel : path;
    const { file, error } = await loadBaseline(path);
    if (error) warnings.push(`baseline ${shown} not applied (${error}), so every finding is shown`);
    else if (file) {
      const a = applyBaseline(kept, hiddenScope, file, today());
      kept = a.active;
      suppressed = sortFindings(a.suppressed);
      // Staleness needs every engine to have looked at the whole tree.
      const full = !opts.partial && ALL_ENGINES.every((e) => engines.includes(e)) && statuses.every((s) => s.ok);
      const stale = full
        ? a.unmatchedEntries.map((e) => ({ id: e.id, kind: e.kind, ruleId: e.ruleId, path: e.path }))
        : undefined;
      baseline = {
        file: shown,
        baselined: a.suppressed.filter((f) => f.suppression?.kind === "baseline").length,
        suppressed: a.suppressed.filter((f) => f.suppression?.kind !== "baseline").length,
        resurfaced: a.resurfaced,
        ...(stale ? { stale } : {}),
      };
      if (stale?.length)
        warnings.push(
          `${shown}: ${stale.length} entr${stale.length === 1 ? "y matches" : "ies match"} no finding (fixed, or the code changed); run \`hagstone baseline prune\``,
        );
    }
  }
  if (opts.reachableOnly) kept = kept.filter((f) => f.reachability?.status !== "unreachable");

  return {
    root,
    findings: sortFindings(kept),
    ignores: ignores.slice(DEFAULT_IGNORES.length),
    warnings,
    engines: statuses,
    hiddenInTests,
    ...(suppressed ? { suppressed } : {}),
    ...(baseline ? { baseline } : {}),
  };
}

export interface ImageScanOptions {
  autoInstall?: boolean;
  /** Use the cached vulnerability database; don't download or update it. */
  offline?: boolean;
  /** Baseline to apply (an image has no repo root, so there is no default one). */
  baseline?: string;
  /**
   * The Dockerfile that builds the image. Findings then point at its final FROM line (where a base
   * image is upgraded), so code scanning, check runs and PR comments get a real repo file; the path
   * inside the image stays in the message.
   */
  dockerfile?: string;
}

/** 1-based line of the last FROM instruction (the stage that becomes the image); 1 if there is none. Pure. */
export function finalFromLine(dockerfile: string): number {
  let line = 1;
  dockerfile.split("\n").forEach((text, i) => {
    if (/^\s*FROM\s/i.test(text)) line = i + 1;
  });
  return line;
}

/** Point image findings at the Dockerfile's final FROM line, keeping the in-image path in the message. Pure. */
export function anchorToDockerfile(findings: Finding[], path: string, text: string): Finding[] {
  const line = finalFromLine(text);
  return findings.map((f) => ({
    ...f,
    message: `${f.message} Found at /${f.location.path} in the image.`,
    location: { path, startLine: line },
  }));
}

/**
 * Scan a container image: syft catalogs it, grype matches the catalog against its vulnerability
 * database. One finding per source package version, like dependency findings for a directory.
 */
export async function scanImage(image: string, opts: ImageScanOptions = {}): Promise<ScanResult> {
  const autoInstall = opts.autoInstall ?? true;
  const started = Date.now();
  const warnings: string[] = [];
  for (const engine of ["syft", "grype"] as const) {
    const v = overrideVar(engine);
    if (process.env[v]) warnings.push(`${engine}: using ${v}=${process.env[v]}, which is not checksum-verified`);
  }
  let findings: Finding[] = [];
  let engines: EngineStatus[];
  try {
    const bins = { syft: await resolveEngine("syft", { autoInstall }), grype: await resolveEngine("grype", { autoInstall }) };
    const out = await runImageScan(bins, image, { offline: opts.offline ?? false });
    findings = dedupe(out.findings);
    warnings.push(...out.warnings);
    if (opts.dockerfile) {
      const rel = relative(process.cwd(), resolve(opts.dockerfile)).split(sep).join("/");
      findings = anchorToDockerfile(findings, rel, await readFile(opts.dockerfile, "utf8"));
    }
    engines = [{ engine: "grype", ok: true, findings: findings.length, ms: Date.now() - started }];
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    warnings.push(`image scan failed: ${error}`);
    engines = [{ engine: "grype", ok: false, findings: 0, ms: Date.now() - started, error }];
  }

  let suppressed: Finding[] | undefined;
  let baseline: BaselineSummary | undefined;
  if (opts.baseline) {
    const { file, error } = await loadBaseline(resolve(opts.baseline));
    if (error) warnings.push(`baseline ${opts.baseline} not applied (${error}), so every finding is shown`);
    else if (file) {
      const a = applyBaseline(findings, [], file, today());
      findings = a.active;
      suppressed = sortFindings(a.suppressed);
      // Image findings never cover a repo's code entries, so nothing can be called stale.
      baseline = {
        file: opts.baseline,
        baselined: a.suppressed.filter((f) => f.suppression?.kind === "baseline").length,
        suppressed: a.suppressed.filter((f) => f.suppression?.kind !== "baseline").length,
        resurfaced: a.resurfaced,
      };
    }
  }
  return {
    root: image,
    findings: sortFindings(findings),
    ignores: [],
    warnings,
    engines,
    ...(suppressed ? { suppressed } : {}),
    ...(baseline ? { baseline } : {}),
  };
}
