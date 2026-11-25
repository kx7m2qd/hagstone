/**
 * Launch-goal tracker: which of the 2025 CWE Top 25 weaknesses that apply to our languages have at
 * least one rule per launch language. Reads `metadata.cwe` from rules/<lang>/*.yml (test files skipped).
 *
 *   npm run coverage:cwe            print the matrix and the score
 *   npm run coverage:cwe -- --json  machine-readable
 *
 * The goal (docs/APPROACH.md, "Launch goal"): every row covered in every launch language, each rule
 * with tests, a bench case and a real-project check, precision >= 0.95. This script only measures the
 * first part; the bench gates measure quality.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RULES = fileURLToPath(new URL("../rules", import.meta.url));

/** Launch languages: rules/<dir> → column label. */
export const LANGUAGES: Record<string, string> = { javascript: "JS/TS", python: "Python", java: "Java" };

/**
 * The 2025 CWE Top 25 (https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html), minus the
 * memory-safety entries (787, 416, 125, 120, 476, 121, 122) that can't occur in these languages and
 * CWE-20 (an umbrella the specific injection rules cover). `accepts`: CWEs that count for the row
 * (a child or the more specific CWE a rule is tagged with). CWE-284 is the access-control pillar; its
 * row needs a rule of its own (world-writable permissions, CWE-732), not the 862/863/306/639 rules.
 */
export const TARGETS: { rank: number; cwe: string; name: string; accepts: string[] }[] = [
  { rank: 1, cwe: "CWE-79", name: "Cross-site scripting", accepts: ["CWE-79"] },
  { rank: 2, cwe: "CWE-89", name: "SQL injection", accepts: ["CWE-89"] },
  { rank: 3, cwe: "CWE-352", name: "Cross-site request forgery", accepts: ["CWE-352", "CWE-1275"] },
  { rank: 4, cwe: "CWE-862", name: "Missing authorization", accepts: ["CWE-862"] },
  { rank: 6, cwe: "CWE-22", name: "Path traversal", accepts: ["CWE-22"] },
  { rank: 9, cwe: "CWE-78", name: "OS command injection", accepts: ["CWE-78"] },
  { rank: 10, cwe: "CWE-94", name: "Code injection", accepts: ["CWE-94", "CWE-95", "CWE-917"] },
  { rank: 12, cwe: "CWE-434", name: "Unrestricted file upload", accepts: ["CWE-434"] },
  { rank: 15, cwe: "CWE-502", name: "Unsafe deserialization", accepts: ["CWE-502"] },
  { rank: 17, cwe: "CWE-863", name: "Incorrect authorization", accepts: ["CWE-863"] },
  { rank: 19, cwe: "CWE-284", name: "Improper access control", accepts: ["CWE-284", "CWE-732"] },
  { rank: 20, cwe: "CWE-200", name: "Sensitive information exposure", accepts: ["CWE-200", "CWE-209", "CWE-532"] },
  { rank: 21, cwe: "CWE-306", name: "Missing authentication", accepts: ["CWE-306"] },
  { rank: 22, cwe: "CWE-918", name: "Server-side request forgery", accepts: ["CWE-918"] },
  { rank: 23, cwe: "CWE-77", name: "Command injection", accepts: ["CWE-77", "CWE-78", "CWE-88"] },
  { rank: 24, cwe: "CWE-639", name: "Authorization bypass via user key (IDOR)", accepts: ["CWE-639"] },
  { rank: 25, cwe: "CWE-770", name: "Resource allocation without limits", accepts: ["CWE-770", "CWE-400", "CWE-1333"] },
];

/** CWE IDs a rule file declares in metadata.cwe. Pure. */
export function ruleCwes(yaml: string): string[] {
  const line = yaml.match(/^\s*cwe:\s*(.+)$/m)?.[1] ?? "";
  return [...new Set(line.match(/CWE-\d+/g) ?? [])];
}

async function langCwes(dir: string): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const names = (await readdir(join(RULES, dir)).catch(() => [] as string[])).filter((n) => n.endsWith(".yml"));
  for (const n of names) {
    for (const c of ruleCwes(await readFile(join(RULES, dir, n), "utf8"))) out.set(c, [...(out.get(c) ?? []), n.slice(0, -4)]);
  }
  return out;
}

async function main(): Promise<void> {
  const langs = Object.keys(LANGUAGES);
  const have = new Map(await Promise.all(langs.map(async (l) => [l, await langCwes(l)] as const)));
  const rows = TARGETS.map((t) => ({
    ...t,
    cells: Object.fromEntries(langs.map((l) => [l, t.accepts.flatMap((c) => have.get(l)!.get(c) ?? [])])),
  }));
  const total = rows.length * langs.length;
  const covered = rows.reduce((n, r) => n + langs.filter((l) => r.cells[l]!.length).length, 0);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ covered, total, rows }, null, 2));
    return;
  }
  const w = Math.max(...TARGETS.map((t) => t.name.length)) + 14;
  console.log(`${"2025 CWE Top 25 (applicable)".padEnd(w)}${langs.map((l) => LANGUAGES[l]!.padEnd(8)).join("")}`);
  for (const r of rows) {
    const label = `${String(r.rank).padStart(2)}. ${r.cwe} ${r.name}`.padEnd(w);
    console.log(label + langs.map((l) => (r.cells[l]!.length ? "✓" : "·").padEnd(8)).join(""));
  }
  console.log(`\ncovered ${covered}/${total} (${Math.round((covered / total) * 100)}%); launch goal ${total}/${total}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`coverage:cwe: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}
