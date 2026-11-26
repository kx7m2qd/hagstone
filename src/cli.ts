#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";
import { isWorkspaceFile, itemsFromSarif, report } from "./action/github.js";
import { baselineCreate, baselinePrune, suppress, type CommandResult } from "./commands/baseline.js";
import { gateSeverity, SEVERITY_ORDER, severityAtLeast, type EngineName, type Severity } from "./core/finding.js";
import { enginePath, installEngine, isInstalled, resolveEngine } from "./engines/install.js";
import { BINARY_ENGINES, ENGINES } from "./engines/manifest.js";
import { rulePasses } from "./engines/opengrep.js";
import { downloadOfflineDbs } from "./engines/osv.js";
import { runSyft, type SbomFormat } from "./engines/syft.js";
import { loadIgnorePatterns } from "./core/ignore.js";
import { run } from "./engines/run.js";
import { install, uninstall } from "./hook/install.js";
import { hookRun } from "./hook/run.js";
import { serve } from "./mcp/protocol.js";
import { createTools, INSTRUCTIONS } from "./mcp/tools.js";
import { toSarif } from "./report/sarif.js";
import { toText } from "./report/text.js";
import { ALL_ENGINES, scan, scanImage, type ScanResult } from "./scan.js";
import { TOOL_NAME, TOOL_VERSION } from "./version.js";

const HELP = `${TOOL_NAME} ${TOOL_VERSION} — local-first application security scanner

Usage:
  ${TOOL_NAME} scan [path]          Scan code, dependencies, secrets, IaC and licenses (default path: .)
      --format text|json|sarif     Output format (default: text)
      --output <file>              Write the report to a file instead of stdout
      --fail-on <severity|none>    Exit 1 if a finding is at least this severe (default: high)
      --engines <list>             Comma-separated subset of: ${ALL_ENGINES.join(", ")}
      --no-install                 Do not auto-install missing engines
      --offline                    Send nothing over the network. Dependency vulnerabilities are
                                   matched against the local database from \`${TOOL_NAME} offline-db\`
                                   (the scan fails if it's missing); the npm/PyPI registry checks
                                   are skipped (typosquat and install-script checks still run).
      --no-reachability            Skip the reachability check. By default, vulnerable dependencies
                                   that nothing in the project uses, or that only tests and dev
                                   tooling use, are shown one severity level lower, but still fail
                                   --fail-on at their original severity.
      --trust-reachability         Let --fail-on use the lowered severity of unreachable and dev-only
                                   findings
      --reachable-only             Hide unreachable findings entirely (implies --trust-reachability)
      --include-tests              Also report code and dependency findings in test, example and
                                   dev-script code (test/, __tests__/, e2e/, examples/, scripts/,
                                   tools/, *.spec.ts, test_*.py, ...). Hidden by default; secrets and
                                   malicious packages are always shown.
      --include-gitignored         Also report findings in files git ignores and doesn't track
                                   (.env.local, .next/, local caches). Skipped by default: they are
                                   never committed. Tracked files are always scanned.
      --include-hardening          Also report IaC hardening checks (Trivy LOW and best-practice checks
                                   that expose nothing on their own). Hidden and counted by default.
      --ignore-file <file>         Read ignore patterns from this file instead of <path>/.hagstoneignore
                                   (CI: pass the base branch's copy so a PR can't un-scan its own code)
      --baseline <file>            Apply this baseline instead of <path>/.hagstone/baseline.json
                                   (CI: pass the base branch's copy so a PR can't hide its own findings)
      --no-baseline                Ignore the baseline: report and gate on every finding
      --image <ref>                Scan a container image instead of a directory (alpine:3.20,
                                   registry:ghcr.io/org/app:1.2, docker:app:dev, oci-archive:app.tar).
                                   Syft catalogs it, Grype matches it; one finding per source package.
                                   The first image scan downloads Grype's vulnerability database
                                   (several GB, cached; --offline uses the cached copy). Takes
                                   --format, --output, --fail-on, --baseline and --offline.
      --dockerfile <file>          With --image: point findings at this Dockerfile's final FROM line
                                   (a repo file, for code scanning and PR checks) instead of paths
                                   inside the image.
      --license-policy <file>      Apply this license policy instead of <path>/.hagstone/licenses.json
                                   ({"allow": [...], "deny": [...]}; CI: pass the base branch's copy).
                                   Default: AGPL/SSPL (high), GPL (medium), non-commercial (high).

  Network: osv-scanner sends package names and versions to api.osv.dev; pkgrisk sends the same to
  registry.npmjs.org and pypi.org; syft looks up Python package licenses on pypi.org. Source code,
  file paths and manifest contents never leave your machine. --offline sends nothing.

  ${TOOL_NAME} offline-db [path]   Download the dependency vulnerability databases the project at [path]
                                    uses (one archive per ecosystem, nothing about the project is sent),
                                    for --offline scans. Run it again to update them.

  ${TOOL_NAME} sbom [path] [--image <ref>] [--format cyclonedx|spdx] [--output <file>] [--offline]
                                    Write an SBOM of the project's shipped dependencies, or of an
                                    image (Syft; CycloneDX JSON by default, or SPDX JSON).

  ${TOOL_NAME} baseline create [path] [--force]
                                    Snapshot every current finding into .hagstone/baseline.json (commit
                                    it). After that, only new findings, or old ones that got worse, are
                                    reported and fail --fail-on. Secrets and malicious packages are
                                    never baselined. --force re-snapshots and keeps your decisions.
  ${TOOL_NAME} suppress <id|path:line> --as false-positive|accepted-risk --reason "…"
                   [--expires YYYY-MM-DD] [--path <path>]
                                    Record a decision about one finding. accepted-risk expires (default
                                    90 days), then the finding fails the gate again. Secrets can only be
                                    marked false-positive; malicious packages can't be suppressed.
  ${TOOL_NAME} baseline prune [path]   Remove entries for findings that are gone (fixed), and re-attach
                                    entries whose code moved or whose fingerprint changed.

  ${TOOL_NAME} engines install      Download and verify the pinned engine binaries
  ${TOOL_NAME} engines status       Show which engines are installed
  ${TOOL_NAME} hook install [--force]  Install a git pre-commit hook. It scans staged content (the
                                    index) with opengrep + gitleaks and only reports added lines.
                                    Secrets always block; other findings block at --fail-on.
  ${TOOL_NAME} hook uninstall       Remove the hook (only if hagstone wrote it; restores a backed-up hook)
  ${TOOL_NAME} hook run [--fail-on <severity|none>]
                                    What the hook calls (default: high). Exit 1 blocked, 2 engine
                                    missing (fail closed). Dependency checks: use \`${TOOL_NAME} scan\` in CI.
                                    Bypass once: git commit with the no-verify flag.
  ${TOOL_NAME} mcp [path]           MCP server on stdio for coding agents (tools: scan, explain,
                                  check_package). Confined to [path] (default: .). Add to Claude Code:
                                  claude mcp add hagstone -- npx -y hagstone mcp
  ${TOOL_NAME} test-rules           Run the rule test suite (rules/**)

Exit codes: 0 clean · 1 findings at or above --fail-on · 2 usage or engine error
`;

function fail(message: string): never {
  process.stderr.write(`${TOOL_NAME}: ${message}\n`);
  process.exit(2);
}

/**
 * Write to stdout and wait until the OS has the data. When stdout is a pipe, Node writes it
 * asynchronously, and `process.exit()` right after a plain write cut large reports off at 64 KB.
 */
function writeStdout(text: string): Promise<void> {
  return new Promise((resolve, reject) =>
    process.stdout.write(text, (e) => (e && (e as NodeJS.ErrnoException).code !== "EPIPE" ? reject(e) : resolve())),
  );
}

function parseEngines(value: string | undefined): EngineName[] | undefined {
  if (!value) return undefined;
  const list = value.split(",").map((s) => s.trim());
  for (const e of list) if (!ALL_ENGINES.includes(e as EngineName)) fail(`unknown engine "${e}"`);
  return list as EngineName[];
}

async function cmdScan(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      format: { type: "string", default: "text" },
      output: { type: "string" },
      "fail-on": { type: "string", default: "high" },
      engines: { type: "string" },
      "no-install": { type: "boolean", default: false },
      offline: { type: "boolean", default: false },
      "reachable-only": { type: "boolean", default: false },
      "no-reachability": { type: "boolean", default: false },
      "trust-reachability": { type: "boolean", default: false },
      "ignore-file": { type: "string" },
      "include-tests": { type: "boolean", default: false },
      "include-gitignored": { type: "boolean", default: false },
      "include-hardening": { type: "boolean", default: false },
      baseline: { type: "string" },
      "no-baseline": { type: "boolean", default: false },
      "license-policy": { type: "string" },
      image: { type: "string" },
      dockerfile: { type: "string" },
    },
  });
  const format = values.format;
  if (format !== "text" && format !== "json" && format !== "sarif") fail(`unknown format "${format}"`);
  const failOn = values["fail-on"];
  if (failOn !== "none" && !SEVERITY_ORDER.includes(failOn as Severity)) fail(`unknown severity "${failOn}"`);

  if (values.image && positionals.length) fail("pass either a path or --image, not both");
  if (values.dockerfile && !values.image) fail("--dockerfile goes with --image");
  const result: ScanResult = values.image
    ? await scanImage(values.image, {
        autoInstall: !values["no-install"],
        offline: values.offline,
        baseline: values.baseline,
        dockerfile: values.dockerfile,
      })
    : await scan(positionals[0] ?? ".", {
        engines: parseEngines(values.engines),
        autoInstall: !values["no-install"],
        offline: values.offline,
        reachability: !values["no-reachability"],
        reachableOnly: values["reachable-only"],
        ignoreFile: values["ignore-file"],
        includeTests: values["include-tests"],
        includeGitignored: values["include-gitignored"],
        includeHardening: values["include-hardening"],
        baseline: values.baseline,
        noBaseline: values["no-baseline"],
        licensePolicy: values["license-policy"],
      });

  const report =
    format === "json"
      ? JSON.stringify(result, null, 2)
      : format === "sarif"
        ? JSON.stringify(toSarif(result), null, 2)
        : toText(result, { color: !values.output && process.stdout.isTTY === true });

  if (values.output) {
    await writeFile(values.output, report + "\n");
    process.stderr.write(`${TOOL_NAME}: wrote ${result.findings.length} findings to ${values.output}\n`);
  } else {
    await writeStdout(report + "\n");
  }
  if (format !== "text") for (const w of result.warnings) process.stderr.write(`warning: ${w}\n`);
  // In GitHub Actions, stale baseline entries become an annotation; they never fail the job.
  const stale = result.baseline?.stale?.length;
  if (stale && process.env.GITHUB_ACTIONS === "true")
    process.stdout.write(`::warning file=${result.baseline!.file}::${stale} baseline entr${stale === 1 ? "y matches" : "ies match"} no finding (fixed, or the code changed). Run \`${TOOL_NAME} baseline prune\` and commit the result.\n`);

  if (result.engines.some((e) => !e.ok)) return 2;
  const trust = values["trust-reachability"];
  if (failOn !== "none" && result.findings.some((f) => severityAtLeast(gateSeverity(f, trust), failOn as Severity))) return 1;
  return 0;
}

async function cmdSbom(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      format: { type: "string", default: "cyclonedx" },
      output: { type: "string" },
      offline: { type: "boolean", default: false },
      "no-install": { type: "boolean", default: false },
      image: { type: "string" },
    },
  });
  const format = values.format as SbomFormat;
  if (format !== "cyclonedx" && format !== "spdx") fail(`unknown SBOM format "${values.format}" (cyclonedx or spdx)`);
  if (positionals.length > 1 || (values.image && positionals.length))
    fail(`usage: ${TOOL_NAME} sbom [path] [--image <ref>] [--format cyclonedx|spdx] [--output <file>] [--offline]`);
  const root = resolvePath(positionals[0] ?? ".");
  const bin = await resolveEngine("syft", { autoInstall: !values["no-install"] });
  const ignores = values.image ? [] : await loadIgnorePatterns(root);
  const sbom = await runSyft(bin, root, ignores, { format, offline: values.offline, image: values.image });
  if (values.output) {
    await writeFile(values.output, sbom);
    process.stderr.write(`${TOOL_NAME}: wrote a ${format === "cyclonedx" ? "CycloneDX" : "SPDX"} SBOM to ${values.output}\n`);
  } else await writeStdout(sbom);
  return 0;
}

async function cmdOfflineDb(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { "no-install": { type: "boolean", default: false } } });
  if (positionals.length > 1) fail(`usage: ${TOOL_NAME} offline-db [path]`);
  const root = resolvePath(positionals[0] ?? ".");
  const bin = await resolveEngine("osv-scanner", { autoInstall: !values["no-install"] });
  const { ecosystems, dir } = await downloadOfflineDbs(bin, root);
  process.stdout.write(
    ecosystems.length
      ? `${TOOL_NAME}: vulnerability databases ready for ${ecosystems.join(", ")} in ${dir}. \`${TOOL_NAME} scan --offline\` uses them.\n`
      : `${TOOL_NAME}: no packages found in ${root}, so there was nothing to download.\n`,
  );
  return 0;
}

function done(res: CommandResult): number {
  (res.code === 0 ? process.stdout : process.stderr).write(`${res.code === 0 ? "" : `${TOOL_NAME}: `}${res.message}\n`);
  return res.code;
}

const commandDeps = { scan, version: TOOL_VERSION };

async function cmdBaseline(args: string[]): Promise<number> {
  const [sub, ...rest] = args;
  if (sub === "create") {
    const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { force: { type: "boolean", default: false } } });
    return done(await baselineCreate(positionals[0] ?? ".", { force: values.force }, commandDeps));
  }
  if (sub === "prune") {
    const { positionals } = parseArgs({ args: rest, allowPositionals: true, options: {} });
    return done(await baselinePrune(positionals[0] ?? ".", commandDeps));
  }
  fail(`usage: ${TOOL_NAME} baseline create|prune [path]`);
}

async function cmdSuppress(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      as: { type: "string" },
      reason: { type: "string" },
      expires: { type: "string" },
      path: { type: "string", default: "." },
    },
  });
  if (positionals.length !== 1 || !values.as)
    fail(`usage: ${TOOL_NAME} suppress <id|path:line> --as false-positive|accepted-risk --reason "…" [--expires YYYY-MM-DD] [--path <path>]`);
  return done(await suppress(positionals[0]!, { root: values.path, kind: values.as, reason: values.reason, expires: values.expires }, commandDeps));
}

async function cmdEngines(args: string[]): Promise<number> {
  const sub = args[0];
  if (sub === "status") {
    for (const name of BINARY_ENGINES) {
      const ok = await isInstalled(name);
      process.stdout.write(`${name.padEnd(12)} ${ENGINES[name].version.padEnd(8)} ${ok ? enginePath(name) : "not installed"}\n`);
    }
    return 0;
  }
  if (sub === "install") {
    for (const name of BINARY_ENGINES) {
      if (await isInstalled(name)) {
        process.stdout.write(`${name}: already installed\n`);
        continue;
      }
      process.stdout.write(`${name}: downloading ${ENGINES[name].version}… `);
      const path = await installEngine(name);
      process.stdout.write(`verified → ${path}\n`);
    }
    return 0;
  }
  fail(`usage: ${TOOL_NAME} engines install|status`);
}

async function cmdHook(args: string[]): Promise<number> {
  const [sub, ...rest] = args;
  if (sub === "install") {
    const { values } = parseArgs({ args: rest, options: { force: { type: "boolean", default: false } } });
    const res = await install({ force: values.force });
    (res.code === 0 ? process.stdout : process.stderr).write(`${TOOL_NAME}: ${res.message}\n`);
    return res.code;
  }
  if (sub === "uninstall") {
    parseArgs({ args: rest, options: {} });
    const res = await uninstall();
    (res.code === 0 ? process.stdout : process.stderr).write(`${TOOL_NAME}: ${res.message}\n`);
    return res.code;
  }
  if (sub === "run") {
    const { values } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: { "fail-on": { type: "string", default: "high" } },
    });
    const failOn = values["fail-on"];
    if (failOn !== "none" && !SEVERITY_ORDER.includes(failOn as Severity)) fail(`unknown severity "${failOn}"`);
    const res = await hookRun({ failOn: failOn as Severity | "none", color: process.stderr.isTTY === true });
    if (res.output) process.stderr.write(res.output);
    return res.code;
  }
  fail(`usage: ${TOOL_NAME} hook install|uninstall|run`);
}

async function cmdTestRules(): Promise<number> {
  const bin = await resolveEngine("opengrep", { autoInstall: true });
  // Same split as a scan: Java's rules are tested with the intrafile analysis they run with.
  const { plain, intrafile } = rulePasses();
  let code = 0;
  for (const [dirs, flags] of [
    [plain, []],
    [intrafile, ["--taint-intrafile"]],
  ] as const) {
    for (const dir of dirs) {
      const res = await run(bin, ["test", ...flags, dir]);
      process.stdout.write(res.stdout);
      process.stderr.write(res.stderr);
      code ||= res.code;
    }
  }
  return code;
}

async function cmdMcp(args: string[]): Promise<number> {
  const { positionals } = parseArgs({ args, allowPositionals: true, options: {} });
  if (positionals.length > 1) fail(`usage: ${TOOL_NAME} mcp [path]`);
  // stdout is the protocol channel: everything else goes to stderr.
  await serve({ name: TOOL_NAME, version: TOOL_VERSION, instructions: INSTRUCTIONS }, createTools(positionals[0] ?? "."), {
    input: process.stdin,
    output: process.stdout,
    log: (line) => process.stderr.write(`${TOOL_NAME} mcp: ${line}\n`),
  });
  return 0;
}

/** Used by action.yml: check run + PR review comments from the SARIF report. Not a user command. */
async function cmdActionReport(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      sarif: { type: "string" },
      "exit-code": { type: "string", default: "0" },
      prefix: { type: "string", default: "" },
      "check-run": { type: "string", default: "true" },
      "pr-comments": { type: "string", default: "true" },
      "min-severity": { type: "string", default: "medium" },
    },
  });
  const env = process.env;
  const min = values["min-severity"] as Severity;
  if (!values.sarif) fail("action-report: --sarif is required");
  if (!SEVERITY_ORDER.includes(min)) fail(`unknown severity "${min}"`);
  if (!env.HAGSTONE_GITHUB_TOKEN || !env.GITHUB_REPOSITORY) {
    process.stdout.write("::notice::Hagstone: no GitHub token or repository; skipping check run and PR comments.\n");
    return 0;
  }
  const event = env.GITHUB_EVENT_PATH ? JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8").catch(() => "{}")) : {};
  await report({
    ctx: { api: env.GITHUB_API_URL ?? "https://api.github.com", repo: env.GITHUB_REPOSITORY, token: env.HAGSTONE_GITHUB_TOKEN, fetch },
    event,
    sha: env.GITHUB_SHA ?? "",
    items: itemsFromSarif(JSON.parse(await readFile(values.sarif, "utf8")), values.prefix),
    exitCode: Number(values["exit-code"]),
    checkRun: values["check-run"] === "true",
    prComments: values["pr-comments"] === "true",
    minSeverity: min,
    log: (line) => process.stdout.write(`${line}\n`),
    inRepo: (path) => isWorkspaceFile(env.GITHUB_WORKSPACE ?? process.cwd(), path),
  });
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case "scan":
      return cmdScan(rest);
    case "sbom":
      return cmdSbom(rest);
    case "engines":
      return cmdEngines(rest);
    case "offline-db":
      return cmdOfflineDb(rest);
    case "baseline":
      return cmdBaseline(rest);
    case "suppress":
      return cmdSuppress(rest);
    case "hook":
      return cmdHook(rest);
    case "mcp":
      return cmdMcp(rest);
    case "test-rules":
      return cmdTestRules();
    case "action-report":
      return cmdActionReport(rest);
    case "--version":
    case "-v":
      process.stdout.write(`${TOOL_VERSION}\n`);
      return 0;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(HELP);
      return 0;
    default:
      fail(`unknown command "${command}". Run \`${TOOL_NAME} --help\`.`);
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => fail(e instanceof Error ? e.message : String(e)),
);
