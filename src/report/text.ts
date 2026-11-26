import { SEVERITY_ORDER, type Severity } from "../core/finding.js";
import { sanitizeForTerminal as safe } from "../core/sanitize.js";
import type { ScanResult } from "../scan.js";

const COLOR: Record<Severity, string> = {
  critical: "\x1b[1;35m",
  high: "\x1b[1;31m",
  medium: "\x1b[33m",
  low: "\x1b[36m",
  info: "\x1b[2m",
};
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

/** Shorten to `max` characters at a word boundary, marking the cut. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:]+$/, "")}…`;
}

export function toText(result: ScanResult, opts: { color: boolean }): string {
  const c = (code: string, s: string) => (opts.color ? `${code}${s}${RESET}` : s);
  const lines: string[] = [];

  // Vulnerable packages only tests or dev tooling use are folded into one summary line each.
  const devOnly = (f: ScanResult["findings"][number]) => f.category === "dependency" && f.reachability?.status === "dev-only";
  const folded = result.findings.filter(devOnly);

  // Every string from a finding is untrusted (it can come from the scanned code).
  for (const f of result.findings) {
    if (devOnly(f)) continue;
    const where = safe(`${f.location.path}:${f.location.startLine}`);
    lines.push(`${c(COLOR[f.severity], f.severity.toUpperCase().padEnd(8))} ${c(BOLD, safe(f.title))}`);
    lines.push(`         ${where}  ${c(DIM, safe(`${f.engine}/${f.ruleId}${f.cwe.length ? "  " + f.cwe.join(",") : ""}`))}`);
    if (f.location.snippet) lines.push(`         ${c(DIM, "│")} ${safe(f.location.snippet).split("\n")[0]?.slice(0, 160)}`);
    if (f.dataflow && f.dataflow.length > 1) {
      const path = f.dataflow.map((s) => `${s.snippet ?? "?"} (L${s.line})`).join(" → ");
      lines.push(`         ${c(DIM, "flow:")} ${safe(path).replace(/\n/g, " ").slice(0, 200)}`);
    }
    if (f.reachability) {
      const r = f.reachability;
      const tag = r.status === "reachable" ? c(COLOR.high, "reachable") : r.status === "unknown" ? "unknown" : c(DIM, r.status);
      const was = r.originalSeverity ? c(DIM, ` (was ${r.originalSeverity})`) : "";
      lines.push(`         ${c(DIM, "reach:")} ${tag}${was}  ${c(DIM, clip(safe(r.reason), 220))}`);
    }
    if (f.resurfaced) lines.push(`         ${c(COLOR.medium, "back:")} ${safe(f.resurfaced).slice(0, 200)}`);
    lines.push(`         ${clip(safe(f.message).split("\n")[0] ?? "", 260)}`);
    lines.push("");
  }

  if (folded.length) {
    lines.push(c(BOLD, `${folded.length} vulnerable ${folded.length === 1 ? "package is" : "packages are"} only used by tests or dev tooling`) + c(DIM, " (severity lowered one level; --format json for details):"));
    for (const f of folded) {
      const d = f.dependency!;
      const fix = d.fixedVersions[0] ? ` → ${d.fixedVersions[0]}` : "";
      lines.push(`         ${c(COLOR[f.severity], f.severity.padEnd(8))} ${safe(`${d.name} ${d.version}${fix}`)}  ${c(DIM, safe(f.location.path))}`);
    }
    lines.push("");
  }

  const counts = SEVERITY_ORDER.map((s) => [s, result.findings.filter((f) => f.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => c(COLOR[s], `${n} ${s}`));
  lines.push(
    result.findings.length
      ? `${c(BOLD, `${result.findings.length} findings`)}: ${counts.join(", ")}`
      : c(BOLD, "No findings."),
  );
  lines.push(
    c(DIM, result.engines.map((e) => `${e.engine} ${e.ok ? `${e.findings} in ${e.ms}ms` : "FAILED"}`).join(" · ")),
  );
  if (result.hiddenInTests)
    lines.push(c(DIM, `${result.hiddenInTests} finding${result.hiddenInTests === 1 ? "" : "s"} in test, example or dev-script code not shown (--include-tests to show)`));
  if (result.hiddenGitignored)
    lines.push(c(DIM, `${result.hiddenGitignored} finding${result.hiddenGitignored === 1 ? "" : "s"} in gitignored, untracked files not shown; they are never committed (--include-gitignored to show)`));
  const b = result.baseline;
  if (b && (b.baselined || b.suppressed)) {
    const parts = [b.baselined ? `${b.baselined} baselined` : "", b.suppressed ? `${b.suppressed} suppressed (false positive / accepted risk)` : ""].filter(Boolean);
    lines.push(c(DIM, `${parts.join(", ")} not shown, from ${safe(b.file)} (--no-baseline to show)`));
  }
  if (b?.resurfaced) lines.push(c(COLOR.medium, `${b.resurfaced} finding${b.resurfaced === 1 ? "" : "s"} from ${safe(b.file)} came back (expired, new advisory, or got worse)`));
  if (result.ignores.length) lines.push(c(DIM, `excluded by .hagstoneignore: ${safe(result.ignores.join(", ")).slice(0, 300)}`));
  for (const w of result.warnings) lines.push(c(COLOR.medium, `warning: ${safe(w)}`));
  return lines.join("\n");
}
