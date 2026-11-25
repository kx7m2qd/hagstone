/**
 * Cross-file taint for Java, built on Opengrep's single-file analysis with method summaries.
 *
 * Opengrep follows taint inside one file only. A controller that passes a request parameter to a
 * repository method in another file is therefore missed. This module closes that gap:
 *
 *  1. Summaries. Two kinds of rule run over the project:
 *     - "param" rules: our request-source rules with the sources replaced by *every method parameter*.
 *       A hit means "parameter k of Class.method reaches a SQL / command / ... sink".
 *     - a "return" rule: request data reaching a `return`. A hit means "Class.method returns request data".
 *  2. The summaries become patterns: a call `(Class $XF7).method(..., <arg k>, ...)` is a sink for
 *     that rule, and a call to a returning method is a source. Rounds repeat until nothing new is
 *     found, so controller → service → repository chains resolve.
 *  3. The real scan runs with these patterns injected into copies of `rules/java/`. A finding at
 *     an injected sink is moved to the sink inside the summarised method (where the fix goes), with
 *     the call site kept in its data flow.
 *
 * Everything runs locally; only Finding objects leave. Calls are matched by receiver type (the class,
 * its supertypes and subtypes), never by method name alone, so an unrelated `find(...)` can't match.
 */
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { isIgnored } from "../core/ignore.js";
import { pathScope } from "../core/scope.js";

export const MAX_ROUNDS = 5;
/** Parameters beyond this position are not summarised. */
const MAX_PARAMS = 8;
/** Parameter types that can't carry an injection. */
const NON_TAINTABLE =
  /^(int|long|short|byte|double|float|boolean|char|Integer|Long|Short|Byte|Double|Float|Boolean|Character|BigInteger|BigDecimal|UUID|LocalDate|LocalDateTime|Instant|HttpServletResponse)$/;

export interface Loc {
  path: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
  lines?: string;
}

export interface SinkSummary {
  id: number;
  rule: string;
  cls: string;
  method: string;
  index: number;
  /** Declared type of that parameter, set when the method is overloaded: the call must pass that type. */
  argType?: string;
  /** The sink inside the summarised method (followed through chained summaries). */
  inner: Loc;
}

export interface SourceSummary {
  id: number;
  cls: string;
  method: string;
}

export interface TypeInfo {
  /** Simple class name → package ("" for the default package). */
  pkg: Map<string, string>;
  /** Simple class name → direct supertypes (simple names). */
  supers: Map<string, Set<string>>;
  /** Simple class name → files that declare it (more than one: the name is ambiguous). */
  files: Map<string, Set<string>>;
}

// ---- types ----------------------------------------------------------------------------------

const DECL = /\b(?:class|interface|enum|record)\s+([A-Z]\w*)(?:\s*<[^{]*?>)?([^{;]*)\{/g;

const simpleName = (t: string) =>
  t
    .replace(/<.*$/s, "")
    .trim()
    .split(".")
    .pop() ?? "";

export const newTypeInfo = (): TypeInfo => ({ pkg: new Map(), supers: new Map(), files: new Map() });

/** Package, classes and their direct supertypes declared in one Java file. Pure. */
export function parseTypes(text: string, into: TypeInfo = newTypeInfo(), file = ""): TypeInfo {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const pkg = code.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1] ?? "";
  for (const m of code.matchAll(DECL)) {
    const name = m[1]!;
    const header = (m[2] ?? "").replace(/<[^<>]*(?:<[^<>]*>[^<>]*)*>/g, "");
    const supers = into.supers.get(name) ?? new Set<string>();
    for (const clause of header.matchAll(/\b(?:extends|implements)\s+([\w.\s,]+?)(?=\bextends\b|\bimplements\b|\bpermits\b|$)/g)) {
      for (const t of clause[1]!.split(",")) {
        const s = simpleName(t);
        if (/^[A-Z]\w*$/.test(s)) supers.add(s);
      }
    }
    into.supers.set(name, supers);
    into.files.set(name, (into.files.get(name) ?? new Set<string>()).add(file));
    if (!into.pkg.has(name)) into.pkg.set(name, pkg);
  }
  return into;
}

/**
 * The class itself, its supertypes and its subtypes (each transitively): the declared types a receiver
 * can have when the call dispatches into `cls`. Each direction is walked on its own; going up and then
 * down would add siblings (every other `HttpServlet` subclass), which can never dispatch here. Pure.
 */
export function relatedTypes(cls: string, types: TypeInfo): string[] {
  const subs = new Map<string, string[]>();
  for (const [sub, sups] of types.supers) for (const s of sups) subs.set(s, [...(subs.get(s) ?? []), sub]);
  const seen = new Set<string>([cls]);
  const walk = (edges: (c: string) => Iterable<string>) => {
    const queue = [cls];
    while (queue.length) {
      for (const n of edges(queue.shift()!)) if (!seen.has(n)) (seen.add(n), queue.push(n));
    }
  };
  walk((c) => types.supers.get(c) ?? []);
  walk((c) => subs.get(c) ?? []);
  // Library supertypes (`HttpServlet`, `Object`) don't declare the project's methods, so a receiver of
  // that type can't dispatch here; keeping them would make every servlet look like a caller.
  return [...seen].filter((t) => t === cls || types.files.has(t)).sort();
}

/** Simple and (when the package is known) fully qualified names, for typed patterns. */
function typeNames(cls: string, types: TypeInfo): string[] {
  const out = new Set<string>();
  for (const t of relatedTypes(cls, types)) {
    out.add(t);
    const p = types.pkg.get(t);
    if (p) out.add(`${p}.${t}`);
  }
  return [...out];
}

async function javaFiles(root: string, ignores: string[]): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".java"))
    .map((e) => join(e.parentPath, e.name))
    .filter((p) => !isIgnored(relative(root, p).split(sep).join("/"), ignores));
}

// ---- rule text ------------------------------------------------------------------------------

/** Our Java rules' top-level keys sit at 4 spaces; split one rule file into them. Pure. */
export function ruleSections(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let key = "";
  for (const line of text.split("\n")) {
    const m = line.match(/^ {4}([a-z-]+):(.*)$/);
    if (m) {
      key = m[1]!;
      out.set(key, m[2]!.trim() ? `${m[2]!.trim()}\n` : "");
    } else if (key) out.set(key, out.get(key)! + line + "\n");
  }
  return out;
}

/** Rules whose sources are request data (the ones cross-file flows matter for). */
/**
 * Taint rules whose sources are general request input join the cross-file pass. A rule with
 * narrower sources (e.g. only role-named parameters) opts out with `xfile: false` in its metadata:
 * injected cross-file sources would drop that restriction.
 */
export const isRequestRule = (text: string) =>
  /mode: taint/.test(text) && /HttpServletRequest \$REQ/.test(text) && !/^\s*xfile:\s*false\b/m.test(text);

function paramSources(): string {
  let s = "";
  for (let k = 0; k < MAX_PARAMS; k++) {
    const before = Array.from({ length: k }, (_, i) => `$XT${i} $XQ${i}, `).join("");
    s += `      - patterns:
          - pattern-inside: |
              class $CLS { ... }
          - pattern: $RET $M(${before}$T${k} $P${k}, ...) { ... }
          - focus-metavariable: $P${k}
`;
  }
  return s;
}

const RETURN_SINKS = `      - patterns:
          - pattern-inside: |
              class $CLS { ... }
          - pattern-inside: |
              $RET $M(...) { ... }
          - pattern: return $E;
          - focus-metavariable: $E
`;

function callPattern(names: string[], recv: string, method: string, args: string): string {
  const typed = names.map((n) => `              - pattern: (${n} ${recv}).${method}(${args})\n`).join("");
  const alternation = names.map((n) => n.replace(/\./g, "\\.")).join("|");
  return (
    typed +
    `              - patterns:
                  - pattern: ${recv}.${method}(${args})
                  - metavariable-regex:
                      metavariable: ${recv}
                      regex: ^(${alternation})$
`
  );
}

function sinkPattern(s: SinkSummary, types: TypeInfo): string {
  const before = Array.from({ length: s.index }, (_, i) => `$XA${i}, `).join("");
  return `      - patterns:
          - pattern-either:
${callPattern(typeNames(s.cls, types), `$XF${s.id}`, s.method, `${before}${s.argType ? `(${s.argType} $XARG)` : "$XARG"}, ...`)}          - focus-metavariable: $XARG
`;
}

function sourcePattern(s: SourceSummary, types: TypeInfo): string {
  return `      - pattern-either:
${callPattern(typeNames(s.cls, types), `$XS${s.id}`, s.method, "...").replace(/^ {4}/gm, "")}`;
}

function insertAfter(text: string, key: string, extra: string): string {
  if (!extra) return text;
  const marker = `    ${key}:\n`;
  const i = text.indexOf(marker);
  return i < 0 ? text : text.slice(0, i + marker.length) + extra + text.slice(i + marker.length);
}

// ---- summaries ------------------------------------------------------------------------------

interface Pos {
  line: number;
  col: number;
  offset?: number;
}
export interface OgMetavars {
  [name: string]: { abstract_content: string; start?: Pos };
}
export interface XfResult {
  check_id: string;
  path: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
  extra: { lines?: string; metavars?: OgMetavars; dataflow_trace?: { taint_source?: unknown } };
}

/** Run Opengrep with these rule files over the project; the caller supplies the runner. */
export type Runner = (configDir: string) => Promise<XfResult[]>;

export interface XfileResult {
  /** Copies of the Java rules with summaries injected. */
  rulesDir: string;
  sinks: SinkSummary[];
  sources: SourceSummary[];
  rounds: number;
}

const mv = (r: XfResult, name: string) => r.extra.metavars?.[name]?.abstract_content;

/** Offset just past the `)` closing the parenthesised list that starts at or after `from`. Pure. */
function closeParen(text: string, from: number): number {
  let depth = 0;
  for (let i = text.indexOf("(", from); i >= 0 && i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i + 1;
  }
  return -1;
}

const NOT_A_TYPE = /^(?:new|return|throw|else|case|yield)$/;

/** Parameter types (generics stripped) of each declaration of `method` in a Java file. Pure. */
export function declarations(text: string, method: string): string[][] {
  const out: string[][] = [];
  const code = text.replace(/\/\*[\s\S]*?\*\//g, (c) => " ".repeat(c.length)).replace(/\/\/.*$/gm, (c) => " ".repeat(c.length));
  const name = method.replace(/[$]/g, "\\$&");
  for (const m of code.matchAll(new RegExp(`([\\w\\]>]+)\\s+${name}\\s*\\(`, "g"))) {
    if (NOT_A_TYPE.test(m[1]!)) continue;
    const open = m.index! + m[0].length - 1;
    const close = closeParen(code, open);
    if (close < 0 || !/^\s*(?:throws[^{;]*)?[{;]/.test(code.slice(close))) continue;
    const list = code.slice(open + 1, close - 1).replace(/@[\w.]+(?:\s*\((?:[^()]|\([^()]*\))*\))?/g, "");
    let depth = 0;
    let cur = "";
    const params: string[] = [];
    for (const ch of list) {
      if (ch === "<") depth++;
      if (ch === ">") depth--;
      if (ch === "," && depth === 0) (params.push(cur), (cur = ""));
      else cur += ch;
    }
    if (cur.trim()) params.push(cur);
    out.push(params.map((p) => paramType(p.replace(/\bfinal\b/g, "").trim().replace(/\s+\S+$/, ""))));
  }
  return out;
}

/** `List<String>` → `List`, `java.io.File` → `java.io.File`, `byte []` → `byte[]`. Pure. */
export const paramType = (t: string) => t.replace(/<.*>/s, "").replace(/\s+/g, "");

/**
 * True when the taint source of an `xf-return` result is one of the method's own parameters (a Spring
 * `@RequestParam`, say). Such a method returns whatever its caller passed; the caller's arguments
 * decide, so it is not a source for callers. Pure.
 */
export function ownParamSource(text: string, r: XfResult): boolean {
  const m = r.extra.metavars?.["$M"]?.start?.offset;
  const src = r.extra.dataflow_trace?.taint_source;
  const at = Array.isArray(src) && src[0] === "CliLoc" ? (src[1] as [{ start?: Pos }])[0]?.start?.offset : undefined;
  if (m === undefined || at === undefined) return false;
  const end = closeParen(text, m);
  return at >= m && end >= 0 && at < end;
}

/** `$XF<n>` bound in a result: the injected sink it matched. */
export function injectedSink(r: XfResult): number | undefined {
  for (const k of Object.keys(r.extra.metavars ?? {})) {
    const m = k.match(/^\$XF(\d+)$/);
    if (m) return Number(m[1]);
  }
  return undefined;
}

const locOf = (r: XfResult): Loc => ({ path: r.path, start: r.start, end: r.end, lines: r.extra.lines });

/** Normalised project-relative path (Opengrep reports `./a/B.java` or `a/B.java`). */
const relPath = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "");

/** Which files call each method (with a receiver: `x.name(`, `Type::name`) and mention each type name. */
export interface CallIndex {
  calls: Map<string, Set<string>>;
  mentions: Map<string, Set<string>>;
}

export const newCallIndex = (): CallIndex => ({ calls: new Map(), mentions: new Map() });

const addTo = (m: Map<string, Set<string>>, k: string, file: string) => m.set(k, (m.get(k) ?? new Set<string>()).add(file));

/** Record one file's receiver calls and capitalised identifiers. Pure. */
export function collectCalls(file: string, text: string, into: CallIndex = newCallIndex()): CallIndex {
  for (const m of text.matchAll(/\.\s*([A-Za-z_$][\w$]*)\s*\(|::\s*([A-Za-z_$][\w$]*)/g)) addTo(into.calls, m[1] ?? m[2]!, file);
  for (const m of text.matchAll(/\b[A-Z][\w$]*\b/g)) addTo(into.mentions, m[0], file);
  return into;
}

/**
 * Is a summary for `cls.method` worth injecting? Only when another file calls `.method(` and names
 * `cls` or a related type, so it could hold a receiver of that type. Entry points (`doGet`) and
 * same-file helpers would otherwise add thousands of patterns that never match. A class name declared
 * in several files is skipped: simple-name typed patterns can't tell those classes apart. Pure.
 */
export function calledElsewhere(index: CallIndex, types: TypeInfo, cls: string, method: string, declaredIn: string): boolean {
  if ((types.files.get(cls)?.size ?? 0) > 1) return false;
  const self = relPath(declaredIn);
  const related = relatedTypes(cls, types);
  for (const f of index.calls.get(method) ?? []) {
    if (f !== self && related.some((t) => index.mentions.get(t)?.has(f))) return true;
  }
  return false;
}

/**
 * Build cross-file summaries for the Java project at `root` and write rule copies that use them.
 * Returns undefined when the project has no Java files.
 */
export async function buildJavaXfile(root: string, ignores: string[], javaRulesDir: string, run: Runner): Promise<XfileResult | undefined> {
  const files = await javaFiles(root, ignores);
  if (!files.length) return undefined;
  const types = newTypeInfo();
  const calls = newCallIndex();
  for (const f of files) {
    const text = await readFile(f, "utf8");
    const rel = relPath(relative(root, f));
    parseTypes(text, types, rel);
    collectCalls(rel, text, calls);
  }

  const rules = new Map<string, string>();
  for (const name of (await readdir(javaRulesDir)).filter((n) => n.endsWith(".yml")).sort()) {
    rules.set(name.slice(0, -4), await readFile(join(javaRulesDir, name), "utf8"));
  }
  const requestRules = [...rules].filter(([, t]) => isRequestRule(t));
  const sinks: SinkSummary[] = [];
  const sources: SourceSummary[] = [];
  const sinkKeys = new Set<string>();
  const sourceKeys = new Set<string>();

  const injectedSinks = (rule: string) => sinks.filter((s) => s.rule === rule).map((s) => sinkPattern(s, types)).join("");
  const injectedSources = () => sources.map((s) => sourcePattern(s, types)).join("");

  /** The summary rules for one round: every request rule with parameters as sources, plus the return rule. */
  const writeSummaryRules = async (dir: string) => {
    for (const [id, text] of requestRules) {
      const sec = ruleSections(text);
      await writeFile(
        join(dir, `xf-param-${id}.yml`),
        `rules:
  - id: xf-param-${id}
    languages: [java]
    severity: INFO
    message: summary
    mode: taint
    pattern-sources:
${paramSources()}    pattern-propagators:
${sec.get("pattern-propagators") ?? ""}    pattern-sanitizers:
${sec.get("pattern-sanitizers") ?? ""}    pattern-sinks:
${sec.get("pattern-sinks") ?? ""}${injectedSinks(id)}`,
      );
    }
    // The return rule needs the broadest request sources: take the rule that lists the most, not the
    // first by name (a new rule sorting first must not narrow every cross-file source).
    const base = requestRules
      .map(([, t]) => ruleSections(t))
      .reduce((a, b) => ((b.get("pattern-sources") ?? "").length > (a.get("pattern-sources") ?? "").length ? b : a));
    await writeFile(
      join(dir, "xf-return.yml"),
      `rules:
  - id: xf-return
    languages: [java]
    severity: INFO
    message: summary
    mode: taint
    pattern-sources:
${base.get("pattern-sources") ?? ""}${injectedSources()}    pattern-propagators:
${base.get("pattern-propagators") ?? ""}    pattern-sanitizers:
${base.get("pattern-sanitizers") ?? ""}    pattern-sinks:
${RETURN_SINKS}`,
    );
  };

  let rounds = 0;
  for (; rounds < MAX_ROUNDS; rounds++) {
    const dir = await mkdtemp(join(tmpdir(), "hagstone-xfile-"));
    const results = await writeSummaryRules(dir)
      .then(() => run(dir))
      .finally(() => rm(dir, { recursive: true, force: true }));
    let added = 0;
    const texts = new Map<string, string>();
    const textOf = async (p: string) => texts.get(p) ?? texts.set(p, await readFile(join(root, p), "utf8").catch(() => "")).get(p)!;
    for (const r of results) {
      const id = r.check_id.split(".").pop() ?? "";
      const cls = mv(r, "$CLS");
      const method = mv(r, "$M");
      if (!cls || !method) continue;
      if (!calledElsewhere(calls, types, cls, method, r.path)) continue;
      if (id === "xf-return") {
        if (ownParamSource(await textOf(r.path), r)) continue;
        const key = `${cls}.${method}`;
        if (sourceKeys.has(key)) continue;
        sourceKeys.add(key);
        sources.push({ id: sources.length, cls, method });
        added++;
        continue;
      }
      const rule = id.replace(/^xf-param-/, "");
      for (let k = 0; k < MAX_PARAMS; k++) {
        if (mv(r, `$P${k}`) === undefined) continue;
        if (NON_TAINTABLE.test(mv(r, `$T${k}`) ?? "")) continue;
        const key = `${rule}|${cls}.${method}|${k}`;
        if (sinkKeys.has(key)) continue;
        sinkKeys.add(key);
        const via = injectedSink(r);
        const inner = via !== undefined && sinks[via] ? sinks[via].inner : locOf(r);
        const decls = declarations(await textOf(r.path), method);
        const t = paramType(mv(r, `$T${k}`) ?? "");
        const argType = decls.length > 1 && /^[\w.]+(?:\[\])*$/.test(t) ? t : undefined;
        sinks.push({ id: sinks.length, rule, cls, method, index: k, argType, inner });
        added++;
      }
    }
    if (!added) break;
  }

  const out = await mkdtemp(join(tmpdir(), "hagstone-java-rules-"));
  try {
    for (const [id, text] of rules) {
      let t = text;
      if (isRequestRule(text)) t = insertAfter(insertAfter(t, "pattern-sinks", injectedSinks(id)), "pattern-sources", injectedSources());
      await writeFile(join(out, `${id}.yml`), t);
    }
  } catch (e) {
    await rm(out, { recursive: true, force: true });
    throw e;
  }
  return { rulesDir: out, sinks, sources, rounds: rounds + 1 };
}

/** Data flow as Opengrep reports it (only the parts we rewrite). */
interface Trace {
  taint_source?: unknown;
  intermediate_vars?: { location: Omit<Loc, "lines">; content: string }[];
  taint_sink?: unknown;
}

/**
 * Move findings that matched an injected sink (a call into a summarised method) to the sink inside
 * that method, where the fix goes. The call site becomes a step in the data flow. Mutates and returns.
 */
export function relocate<R extends XfResult & { extra: { dataflow_trace?: Trace } }>(results: R[], sinks: SinkSummary[]): R[] {
  for (const r of results) {
    const id = injectedSink(r);
    const inner = id === undefined ? undefined : sinks[id]?.inner;
    if (!inner) continue;
    // A call from test or example code stays there: moving it would make it look like a shipped bug.
    if (pathScope(relPath(r.path)) !== "prod" && pathScope(relPath(inner.path)) === "prod") continue;
    const call = { path: r.path, start: r.start, end: r.end };
    const trace: Trace = r.extra.dataflow_trace ?? {};
    trace.intermediate_vars = [...(trace.intermediate_vars ?? []), { location: call, content: r.extra.lines ?? "" }];
    trace.taint_sink = ["CliLoc", [{ path: inner.path, start: inner.start, end: inner.end }, inner.lines ?? ""]];
    r.extra.dataflow_trace = trace;
    r.path = inner.path;
    r.start = inner.start;
    r.end = inner.end;
    r.extra.lines = inner.lines;
  }
  return results;
}
