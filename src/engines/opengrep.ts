import { readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collapseOverlaps,
  fingerprint,
  normalizeCode,
  redactStringLiterals,
  type DataflowStep,
  type Finding,
  type Severity,
} from "../core/finding.js";
import { buildJavaXfile, relocate, type OgMetavars } from "./java-xfile.js";
import { toRelative } from "./paths.js";
import { run } from "./run.js";
import type { EngineOutput } from "./types.js";

export const RULES_DIR = fileURLToPath(new URL("../../rules", import.meta.url));

/**
 * Rule directories (one per language) scanned with `--taint-intrafile`. It follows taint through
 * helper methods in the same file: on the OWASP Benchmark it roughly doubles the Java score, but it
 * lowers Python's (more false positives), so it is chosen per language.
 */
export const INTRAFILE_RULE_DIRS = new Set(["java"]);

/** Split `rules/<lang>/` into the default pass and the intrafile pass. Pure apart from the listing. */
export function rulePasses(rulesDir: string = RULES_DIR): { plain: string[]; intrafile: string[] } {
  const dirs = readdirSync(rulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return {
    plain: dirs.filter((d) => !INTRAFILE_RULE_DIRS.has(d)).map((d) => join(rulesDir, d)),
    intrafile: dirs.filter((d) => INTRAFILE_RULE_DIRS.has(d)).map((d) => join(rulesDir, d)),
  };
}

interface OgPos {
  line: number;
  col: number;
}
interface OgLoc {
  path: string;
  start: OgPos;
  end: OgPos;
}
type OgCliLoc = ["CliLoc", [OgLoc, string]];

interface OgResult {
  check_id: string;
  path: string;
  start: OgPos;
  end: OgPos;
  extra: {
    message: string;
    severity: string;
    lines?: string;
    metadata?: Record<string, unknown>;
    metavars?: OgMetavars;
    dataflow_trace?: {
      taint_source?: OgCliLoc;
      intermediate_vars?: { location: OgLoc; content: string }[];
      taint_sink?: OgCliLoc;
    };
  };
}

export interface OgError {
  type?: string | unknown[];
  level?: string;
  message?: string;
  path?: string;
}

export interface OgOutput {
  results: OgResult[];
  errors: OgError[];
}

/** Rules for hardcoded credentials: their matched code contains the secret itself. */
const CREDENTIAL_CWES = new Set(["CWE-798", "CWE-259", "CWE-321", "CWE-547"]);

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

function mapSeverity(engineSeverity: string, metadata: Record<string, unknown>): Severity {
  const override = metadata["severity"];
  if (typeof override === "string" && SEVERITIES.includes(override as Severity)) return override as Severity;
  if (engineSeverity === "ERROR") return "high";
  if (engineSeverity === "WARNING") return "medium";
  return "low";
}

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return typeof v === "string" ? [v] : [];
}

/** "CWE-78: Improper Neutralization..." → "CWE-78" */
function cweIds(v: unknown): string[] {
  return asList(v).map((s) => s.match(/CWE-\d+/)?.[0] ?? s);
}

function confidence(v: unknown): Finding["confidence"] {
  const s = String(v ?? "").toLowerCase();
  return s === "high" || s === "medium" || s === "low" ? s : undefined;
}

/** Opengrep prefixes rule ids with the config directory path; our ids contain no dots. */
export function ruleIdOf(checkId: string): string {
  return checkId.split(".").pop() ?? checkId;
}

function dataflow(root: string, r: OgResult, clean: (s: string) => string): DataflowStep[] | undefined {
  const t = r.extra.dataflow_trace;
  if (!t) return undefined;
  const steps: DataflowStep[] = [];
  const push = (loc: OgLoc, snippet: string) => {
    const step = { path: toRelative(root, loc.path), line: loc.start.line, snippet: clean(snippet) };
    const last = steps[steps.length - 1];
    if (last?.path !== step.path || last.line !== step.line || last.snippet !== step.snippet) steps.push(step);
  };
  if (t.taint_source?.[0] === "CliLoc") push(...t.taint_source[1]);
  for (const v of t.intermediate_vars ?? []) push(v.location, v.content);
  if (t.taint_sink?.[0] === "CliLoc") push(...t.taint_sink[1]);
  return steps.length ? steps : undefined;
}

const pos = (p: { line: number; col: number }) => p.line * 1e6 + p.col;
/** True when `outer`'s range strictly contains `inner`'s. */
function contains(outer: { start: { line: number; col: number }; end: { line: number; col: number } }, inner: typeof outer): boolean {
  const [os, oe, is, ie] = [pos(outer.start), pos(outer.end), pos(inner.start), pos(inner.end)];
  return os <= is && ie <= oe && (os !== is || oe !== ie);
}

export function normalizeOpengrep(root: string, out: OgOutput): Finding[] {
  const occurrences = new Map<string, number>();
  // A taint rule reports one result per source reaching the same sink; keep one per range.
  const ranges = new Set<string>();
  const unique = out.results.filter((r) => {
    const key = [r.check_id, r.path, r.start.line, r.start.col, r.end.line, r.end.col].join("\u0000");
    return ranges.has(key) ? false : (ranges.add(key), true);
  });
  // Two sink patterns of one rule can match nested expressions (`return jsonify(x)` and
  // `jsonify(x)`): one issue, so keep only the innermost range.
  const results = unique.filter(
    (r) => !unique.some((o) => o !== r && o.check_id === r.check_id && o.path === r.path && contains(r, o)),
  );
  return results.map((r) => {
    const meta = r.extra.metadata ?? {};
    const ruleId = ruleIdOf(r.check_id);
    const path = toRelative(root, r.path);
    const cwe = cweIds(meta["cwe"]);
    // Never let a hardcoded secret reach the Finding: redact literals in every
    // excerpt, and fingerprint the redacted code so the hash is not an oracle.
    const clean = cwe.some((c) => CREDENTIAL_CWES.has(c)) ? redactStringLiterals : (s: string) => s;
    const lines = r.extra.lines === undefined ? undefined : clean(r.extra.lines);
    const code = normalizeCode(lines ?? "");
    const key = `${ruleId}|${path}|${code}`;
    const n = occurrences.get(key) ?? 0;
    occurrences.set(key, n + 1);
    return {
      id: fingerprint("opengrep", ruleId, path, code, String(n)),
      category: "code",
      engine: "opengrep",
      ruleId,
      title: typeof meta["title"] === "string" ? meta["title"] : ruleId,
      message: r.extra.message.trim(),
      severity: mapSeverity(r.extra.severity, meta),
      confidence: confidence(meta["confidence"]),
      location: {
        path,
        startLine: r.start.line,
        endLine: r.end.line,
        startColumn: r.start.col,
        snippet: lines?.trim(),
      },
      cwe,
      owasp: asList(meta["owasp"]),
      dataflow: dataflow(root, r, clean),
    } satisfies Finding;
  });
}

/**
 * Engine errors about a target file can quote its source, so for those keep only
 * the error type and path. Errors without a path concern our own rules.
 */
export function describeError(root: string, e: OgError): string {
  const type = Array.isArray(e.type) ? String(e.type[0]) : (e.type ?? "error");
  if (e.path) return `opengrep: ${type} in ${toRelative(root, e.path)}`;
  return `opengrep: ${e.message ?? type}`.slice(0, 300);
}

export interface OpengrepOptions {
  /** Rules file or directory, run in one pass. Default: all of `rules/`, split by `rulePasses`. */
  config?: string;
  /** Follow taint through functions in the same file (`--taint-intrafile`). */
  taintIntrafile?: boolean;
  /** `config` is the Java rules: add cross-file summaries (`java-xfile.ts`). On by default for Java. */
  javaCrossFile?: boolean;
}

async function runOnce(bin: string, root: string, ignores: string[], configs: string[], intrafile: boolean): Promise<OgOutput> {
  // `--exclude=<p>` (not two argv items) so a pattern can never be read as a flag.
  const excludes = ignores.map((p) => `--exclude=${p.replace(/\/$/, "")}`);
  const args = [
    "scan",
    ...configs.map((c) => `--config=${c}`),
    "--json",
    "--quiet",
    // The scanned repo is untrusted: it must not be able to silence findings with
    // inline `nosemgrep` comments or its own .semgrepignore. Suppression goes
    // through .hagstoneignore only, which every report lists.
    "--disable-nosem",
    "--x-ignore-semgrepignore-files",
    ...(intrafile ? ["--taint-intrafile"] : []),
    ...excludes,
    "--",
    ".",
  ];
  const res = await run(bin, args, { cwd: root });
  if (res.code !== 0 && !res.stdout.trim().startsWith("{")) {
    throw new Error(`opengrep exited ${res.code}: ${res.stderr.trim().slice(0, 500)}`);
  }
  return JSON.parse(res.stdout) as OgOutput;
}

/** The Java pass: summaries first, then the rules with them injected; findings moved to the inner sink. */
async function runJava(bin: string, root: string, ignores: string[], javaDir: string): Promise<OgOutput> {
  const xf = await buildJavaXfile(root, ignores, javaDir, async (dir) => (await runOnce(bin, root, ignores, [dir], true)).results);
  if (!xf) return runOnce(bin, root, ignores, [javaDir], true);
  try {
    const out = await runOnce(bin, root, ignores, [xf.rulesDir], true);
    relocate(out.results, xf.sinks);
    return out;
  } finally {
    await rm(xf.rulesDir, { recursive: true, force: true });
  }
}

export async function runOpengrep(bin: string, root: string, ignores: string[], opts: OpengrepOptions = {}): Promise<EngineOutput> {
  const passes: (() => Promise<OgOutput>)[] = [];
  if (opts.config) {
    const config = opts.config;
    passes.push(() => (opts.javaCrossFile ? runJava(bin, root, ignores, config) : runOnce(bin, root, ignores, [config], !!opts.taintIntrafile)));
  } else {
    const { plain, intrafile } = rulePasses();
    if (plain.length) passes.push(() => runOnce(bin, root, ignores, plain, false));
    for (const dir of intrafile) {
      passes.push(() => (dir.endsWith(`${sep}java`) ? runJava(bin, root, ignores, dir) : runOnce(bin, root, ignores, [dir], true)));
    }
  }
  const outs = await Promise.all(passes.map((p) => p()));
  const findings = outs.flatMap((out) => normalizeOpengrep(root, out));
  const warnings = [...new Set(outs.flatMap((out) => out.errors.map((e) => describeError(root, e))))];
  return { findings: collapseOverlaps(findings), warnings };
}
