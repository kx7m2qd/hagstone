# Hagstone — Build Approach

> Named after the hagstone: a stone with a hole worn through it that, in folklore, lets you see things
> as they really are. Called Vigil until 0.2.0; `.vigilignore`, `VIGIL_HOME` and hooks installed as
> vigil still work.

## 1. What we are building

**The complete application security platform** (agreed 2026-11-18). A team picks Hagstone because it
covers everything: code (SAST), dependencies (SCA), secrets, supply chain, infrastructure as code,
containers, SBOM and licenses, running apps and APIs (DAST), IDE, dashboard and compliance reports. They
shouldn't need a second tool. On top of that coverage it **finds fewer, realer issues, proves which ones
matter, and fixes them**, and it's built for codebases that AI writes.

**Who we compete with: every application security tool** (agreed 2026-11-18). A buyer should be able
to replace any of them, or several at once, with Hagstone:

| Kind of tool | Examples | What we must match, then beat |
|---|---|---|
| Enterprise SAST/DAST suites | Sparrow, Checkmarx One, Veracode, Fortify (OpenText), HCL AppScan | Language breadth, compliance reports, on-prem / air-gapped, certification |
| Developer-first platforms | Snyk, Aikido, Semgrep, SonarQube, GitHub Advanced Security | Developer experience, PR integration, low noise, price |
| SCA / supply chain | Snyk Open Source, Endor Labs, Socket, Mend, Black Duck, Dependabot | Reachability, malicious-package detection, SBOM, licenses |
| Secrets | GitGuardian, TruffleHog, GitHub secret scanning | Coverage, validity checks, redaction |
| IaC / containers | Checkov / Prisma Cloud, Trivy / Aqua, Wiz Code, Snyk IaC / Container | Coverage of the main formats and registries |
| DAST / API | Burp Suite, Invicti / Acunetix, StackHawk, ZAP | Authenticated scans, API coverage, access-control testing |

**How we get there:**
- **Complete comes from wrapping.** We don't build engines. Each category is a proven open-source engine,
  pinned and verified, normalized into one `Finding`. A new category is an engine wrapper plus rules,
  tests and a benchmark, not years of engine work.
- **Best comes from the layer above the engines**, which is where most of these tools are weak:
  noise cutting (reachability, dev-only, test scope, baseline), proof (public benchmarks), AI triage
  with written reasoning, verified fixes, and linking findings across engines (a DAST hit and the SAST
  finding for the same flaw become one finding marked "confirmed exploitable").
- **Quality bar per category:** a new engine ships only when it meets the same standard as today:
  pinned, normalized, benchmarked, quiet. A noisy category would undo our main selling point.

Common weaknesses across these tools, and our answers:

| Weakness (examples) | Our answer |
|---|---|
| Vague fix advice, thin finding descriptions (Sparrow) | AI triage with written reasoning per finding |
| Low recall (Sparrow: 49 missed vs 14 found in an ACM study); accuracy claimed, not shown | Public benchmark gate on every change |
| Upload-your-code or repo-access SaaS (most cloud platforms) | Scans run locally / in the customer's CI; only findings leave |
| Too many findings, little prioritization (most SAST and SCA tools) | Reachability, dev-only, test scope, baseline; one finding per package |
| Features split by tier/module, per-user price (enterprise suites, GHAS) | One product, every engine, every tier |
| Rationed AI fixes (Sparrow: 200/month) | Verified fix PRs, no quota |
| Several tools for one job (SAST + SCA + secrets + DAST from different vendors) | One scan, one finding model, one report |
| SAST and DAST reported separately | One finding per flaw; DAST-confirmed SAST findings ranked first |

**Buyer groups** (we serve all of them; the order is set by the roadmap):
1. **Developers and small teams** (Snyk, Aikido, Semgrep, GHAS territory): a free tool that's quieter and
   explains itself, in CI, the IDE and AI coding agents. Now.
2. **Security teams at mid-size companies:** dashboard, ownership, SLAs, compliance reports (ISO 27001,
   SOC 2, EU CRA). Step 5.
3. **Regulated enterprise and public sector** (Sparrow, Checkmarx, Fortify, Veracode territory): broad
   language coverage (Java, C#, C/C++), on-prem / air-gapped, reports in the buyer's language, local
   guidelines (e.g. Korea's 행정안전부 소프트웨어 개발보안 가이드, from general knowledge: verify), and
   certification such as Common Criteria.

**Decided (2026-11-25): India first**, then other regions gradually; the product goal stays global.
Implications to verify before building: compliance mappings for Indian frameworks (CERT-In directions,
the DPDP Act and its rules, RBI and SEBI cyber-security frameworks for BFSI), detection of Indian
service credentials and personal identifiers (Aadhaar, PAN) in code and logs, and the stacks common
there (Java/Spring in BFSI and services, Node and Python in startups). Korea-specific work (eGovFrame,
the Korean guideline) moves later.

### Coverage (the "complete" checklist)

| Capability | Status | Engine (license to verify before wrapping) |
|---|---|---|
| SAST: JavaScript/TypeScript, Python | ✅ 59 rules (31 JS/TS, 28 Python), taint-aware | Opengrep + our rules |
| SAST: Java | ✅ 24 rules (OWASP Benchmark for Java categories plus the CWE Top 25 launch set), same-file and cross-file taint | Opengrep + our rules + method summaries |
| SAST: Go, C#, PHP, Kotlin, Ruby | ❌ | Opengrep + our rules |
| SAST: C/C++ | ❌ (last: memory bugs need different analysis) | TBD |
| Dependency vulnerabilities (SCA) + reachability | ✅ | OSV-Scanner |
| Secrets | ✅ | Gitleaks |
| Supply chain (malicious, typosquat, install scripts) | ✅ | pkgrisk (ours) |
| Infrastructure as code (Terraform, Kubernetes, Dockerfile, Helm, CloudFormation) | ✅ exposures only; hardening hidden | Trivy (Apache-2.0; KICS/Checkov can't be pinned) |
| Container images | ✅ CLI (`--image`) and Action (`image`) | Syft → Grype (Apache-2.0) |
| SBOM (CycloneDX / SPDX), license compliance | ✅ | Syft (Apache-2.0) |
| DAST: running web apps | ❌ | ZAP + Nuclei |
| API security (OpenAPI-driven) | ❌ | ZAP |
| Access-control testing (multi-role IDOR) | ❌ | ours |
| Mobile (APK/IPA) | ❌ | MobSF is GPL-3: needs a licensing decision |
| IDE (VS Code, JetBrains) | ❌ | ours |
| Baseline / suppressions | ✅ | ours |
| AI triage, triage memory, verified fixes | ❌ | ours |
| Dashboard, ownership, SLAs (self-hostable) | ❌ | ours |
| Compliance reports (Korean guideline, ISO 27001, SOC 2, EU CRA) | ❌ | ours |
| RASP, runtime context (cloud / Kubernetes) | ❌ | later |

## 2. Principles (non-negotiable)

1. **Local-first.** Engines run on the developer's machine or their CI. Source code never
   reaches our servers. This removes breach liability and compute cost for a solo builder.
2. **Measured, not claimed.** Every rule and every triage prompt is scored by the benchmark
   (`npm run bench`). A change that lowers precision or recall below the gate does not merge.
3. **Every rule ships with tests.** A rule without `ruleid:` and `ok:` test cases is not a rule.
4. **Pinned, verified engines.** Engine binaries are pinned by version and SHA-256.
5. **Never leak secrets.** Secret values are redacted at the normalizer; raw values never reach
   output, logs, or the AI layer.
6. **One finding model.** All engines normalize into `Finding` (`src/core/finding.ts`).
   Everything downstream (reports, triage, dashboard, PR comments) only sees `Finding`.

## 3. Architecture

```
 hagstone scan <path>              (files)
      ├─ engines/opengrep   → SAST, our rules in rules/  ─┐
      ├─ engines/osv        → lockfiles (SCA)             │
      ├─ engines/gitleaks   → secrets                     │
      ├─ engines/pkgrisk    → supply chain                ├─ normalize → Finding[] → scope / ignore / dedupe
      ├─ engines/trivy      → IaC (sanitized copy)        │
      ├─ engines/syft       → licenses; `hagstone sbom`   │
      ├─ engines/grype      → `scan --image` (Syft → Grype)│        → reachability → baseline
      │                                                   │                  │
 hagstone dast <url>  (planned; running app in the        │                  ├─ correlate (DAST ↔ SAST)
      └─ ZAP, Nuclei, access-control agent  customer's CI)┘                  ├─ report: text / json / sarif / PR
                                                                             ├─ AI triage + memory
                                                                             ├─ fix + verify → PR
                                                                             └─ findings → self-hostable dashboard
```

Code layout:

```
src/core/       Finding model, fingerprints, severity, ignore rules
src/engines/    one file per engine: run it, normalize its JSON; manifest.ts pins binaries
src/report/     text, sarif
src/cli.ts      entry point
rules/          our own Opengrep rules, each with a same-named test file
bench/          labeled benchmark cases + scorer
test/           unit tests (vitest)
```

## 4. Roadmap (solo engineer + Claude Code)

### Phase 0 — Foundation (weeks 0–4)  ✓ done
- [x] CLI: `hagstone scan` with text/json/sarif output and `--fail-on`
- [x] Engines: Opengrep, osv-scanner, Gitleaks — pinned, checksum-verified, auto-installed
- [x] Unified `Finding` model with stable fingerprints
- [x] First 10 rules (JS/TS + Python) with tests
- [x] Benchmark harness with precision/recall gate (`bench/run.ts`, `bench/thresholds.json`, first cases)
- [x] Unit tests for the Finding model, ignore rules, engine normalizers, SARIF
- [x] Grow rules to ~40 using the rule loop (§5) — 40 rules (JS + Python); every OWASP Python category has a rule
- [x] OWASP Benchmark for Python: `npm run bench:owasp`, pinned + checksum-verified, per-category gate
- [x] OWASP Benchmark for Java: `npm run bench:owasp:java` (2026-11-20), same gate; both run in CI
  (no labelled OWASP suite exists for JS)
- [x] 20 real CVE fixes (npm + PyPI advisories): `npm run bench:cves`, vulnerable vs fixed file, pinned + verified

### Phase 1 — MVP  ✓ done (released through 0.3.0)
Malicious / non-existent package detection (npm + PyPI), import-level reachability for JS/Python
(incl. `dev-only`), test/example scope, one finding per vulnerable package, pre-commit hook
(`hagstone hook install`), GitHub Action (scan, SARIF upload, severity gate, PR comments + check run;
spec `docs/specs/pr-feedback.md`), MCP server (`hagstone mcp`; spec `docs/specs/mcp-server.md`),
npm releases with provenance.

### Path to the complete platform (agreed 2026-11-18)
Breadth first, through wrapping, without lowering the quality bar. Each step adds whole categories.

**Step 1 — Baseline + suppressions** ✓ built 2026-11-19 (spec `docs/specs/baseline.md`). Every new engine adds findings, so teams need a way to
accept what exists before we add more.

Design (agreed 2026-11-18): one committed file (`.hagstone/baseline.json`) holding
   (a) a baseline snapshot, so only new findings are reported / gate, and (b) per-finding decisions
   (`false-positive` | `accepted-risk`) with a reason. No inline comments: the scanned repo is untrusted,
   and a PR could silence the code it adds. The Action reads the base branch's copy (like
   `.hagstoneignore`) and warns when a PR changes it. Secrets: only `false-positive`, with a reason;
   known-malicious packages: never. Entries keep fingerprint + rule + path + a redacted excerpt; match
   by fingerprint, fall back to rule + normalized code (survives renames); unmatched entries are
   reported as stale. This is the store that triage memory (step 6) reads and writes.
   - Reports: text hides them behind a count line; JSON keeps them with a `suppression` field;
     never in PR comments / check run; left out of SARIF (GitHub doesn't document SARIF
     `suppressions`, so the alert simply closes as fixed).
   - `accepted-risk` needs an `expires` date (default 90 days), then the finding gates again;
     `false-positive` never expires.
   - A matched finding resurfaces as new if it gains an advisory not in the stored list, or its
     gate severity rises (e.g. unreachable → reachable).
   - CLI: `hagstone baseline create` (refuses if the file exists unless `--force`, which says how
     many new findings it swallows), `hagstone suppress <id|path:line> --as … --reason … [--expires …]`,
     `hagstone baseline prune`. No "re-absorb everything" command.
   - MCP stays read-only: an agent can't suppress what it introduced. AI triage may suggest entries.
   - Applies automatically when the file exists (CLI, Action, hook, MCP); `--no-baseline` shows
     everything; `--baseline <file>` points elsewhere (the Action passes the base branch's copy).
   - The file records a `schema` version and the Hagstone version that wrote it. Dependency entries
     also fall back to ecosystem + name + version. Any future fingerprint change ships a migration
     that rewrites the file on the next `suppress` / `prune`, so upgrades never drop decisions.
   - Stale entries only warn (report line + Action `::warning`); they never fail the gate.
   - Entry: kind, reason, date, `expires` (accepted-risk), stored advisories + gate severity,
     redacted excerpt. No author field (git blame has it; keeps personal data out). Pretty JSON,
     entries sorted by fingerprint, for readable diffs and few merge conflicts.

**Step 2 — IaC, containers, SBOM + licenses.** Spec `docs/specs/iac-containers-sbom.md` (engines chosen
2026-11-20 after the license + pinning check). IaC via Trivy ✓ built 2026-11-20 (exposures reported,
hardening hidden, repo can't silence checks or trigger module downloads; bench cases in
`bench/cases/iac/`). Licenses + SBOM via Syft ✓ built 2026-11-20 (`.hagstone/licenses.json` policy,
base-branch copy in the Action; `hagstone sbom`; later VEX, AI-BOM and Cosign signing). Container
images via Syft → Grype ✓ built 2026-11-20 (`hagstone scan --image`; one finding per source package;
osv-scanner on a Syft SBOM was tried and missed openssl/zlib on Alpine). Action `image` input ✓
(findings anchored to the Dockerfile's FROM line; separate code scanning category). Engine signatures
and provenance verified in CI (`engine-signatures.yml`) ✓. Open: a pinned-image recall bench (needs
network + Grype's DB). Each: pinned + verified, normalized into
`Finding`, benchmark cases.

**Step 3 — SAST depth.** Java started 2026-11-20 (spec `docs/specs/java-sast.md`): 11 rules covering
the OWASP Benchmark for Java's categories, average score 0.72 with a per-category gate; Spring app
bench case. Cross-file taint added 2026-11-25 (method summaries on top of Opengrep): average 0.77, 0
injection misses. 2026-11-25, launch-goal batch 1: SSRF (Python, Java), Java deserialization + Jackson
typing, Java SpEL/script injection, ReDoS (Python, Java), Django upload limits; coverage 21 → 27/51.
Batches 2-3 the same day: CSRF, upload filename, stack-trace exposure, client-controlled
authorization, world-writable permissions, IDOR, admin routes without authentication or a role
check, in all three languages; coverage 51/51 (rules, tests, bench cases, real-project check).
- Languages, in order: **Java** (Spring, eGovFrame; gate on the OWASP Benchmark for Java), **Go**,
  then C#, PHP, Kotlin, Ruby; **C/C++** last (memory bugs need a different kind of analysis).
  Each language gets real-CVE-fix benchmark cases like `bench:cves`.
- **Launch goal (set 2026-11-25): we go live when it is met.** Every 2025 CWE Top 25 weakness that
  applies to memory-safe languages (17: the list minus 7 memory-safety entries and the CWE-20
  umbrella) is covered in each launch language: **JavaScript/TypeScript, Python, Java** (51 slots).
  "Covered" means a rule with `ruleid:`/`ok:` tests, a bench case, a real-project check, and precision
  >= 0.95 on the bench. Access-control weaknesses (862, 863, 284, 639, 306) count as covered when the
  common framework mistakes are caught (unprotected routes, `permitAll`, lookups by a request id with
  no ownership check). Measured by `npm run coverage:cwe`; 2026-11-25: 21/51, after batch 1: 27/51, after batches 2-3: **51/51**. Estimated 40-60 new
  rules (~100-110 total). Go, PHP and others come after launch.
- Cross-file taint: Java has our own summary layer (`java-xfile.ts`); reuse that design for the next
  languages before reaching for a deeper engine.
- Rule metadata gains local guideline mappings (Indian frameworks first; see the market decision) alongside
  CWE and OWASP, starting with whichever market we focus on first.
- AI-app rules, continuing: LLM output → SQL/shell/eval sinks, prompt-injection paths, unsafe model
  loading (pickle / `torch.load`), over-permissioned MCP server configs (started:
  `py-llm-output-to-dangerous-sink`).

**Step 4 — DAST + API.** `hagstone dast <url>` against a running app in the customer's CI / staging
(local-first still holds: only findings leave). ZAP (crawl + active scan) and Nuclei (known issues);
OpenAPI-driven API scanning; authenticated scans (login script or token); the access-control agent
(log in as several roles, test whether user A can read user B's data — IDOR). **Correlation:** a DAST
hit and the SAST finding for the same flaw become one finding marked "confirmed exploitable", ranked first.

**Step 5 — Platform.** Self-hostable dashboard (receives findings only; regulated buyers won't send
even findings to a SaaS), ownership (CODEOWNERS, then git blame), fix SLAs, time-to-fix and fix-rate
views, compliance reports (Korean guideline, ISO 27001, SOC 2, EU CRA) built from findings + baseline
decisions, VS Code then JetBrains, GitLab, GitHub App, importers for other tools' results (Sparrow, Checkmarx, Snyk, SonarQube, Semgrep, …) so teams can switch.

**Step 6 — AI layer** across every category:
- AI triage: per new finding, build context (code slice + taint trace) → model → verdict
  (`true_positive | false_positive | needs_review`) + explanation. Cache by fingerprint.
  Local model first, Claude opt-in with the user's own key.
- Triage memory: decisions stored in the baseline file and fed back into triage, so each repo gets
  quieter over time.
- Fix agent: patch → re-scan → run project tests → only then propose. Fix PRs in the Action.

### Later
Mobile (APK/IPA; MobSF is GPL-3, decide licensing first), RASP, runtime context (read-only cloud /
Kubernetes: rank findings reachable in code, deployed and internet-exposed first), API discovery +
OpenAPI diff, threat-model-from-code agent.

### Certification (year 2, or earlier if the first market requires it)
Common Criteria, air-gapped deployments, MISRA for C/C++.

## 5. How we work (the loops)

### Feature loop
1. Write a short spec in `docs/specs/<feature>.md`: goal, inputs/outputs, edge cases, done-criteria.
2. Ask Claude Code to implement it **with tests**, referencing the spec.
3. `npm run check` (typecheck + unit tests + rule tests) and `npm run bench`.
4. Review the diff yourself — always by hand for anything touching auth, tokens, GitHub
   permissions, network calls, or secret handling.

### Rule loop (aim: 10–20 rules/week)
1. Pick a vulnerability class or a real CVE + its fix commit.
2. Prompt: *"Write an Opengrep rule `<id>` for <class>. Add `rules/<lang>/<id>.<ext>` with at
   least 3 `ruleid:` cases and 3 `ok:` cases including the realistic safe fix. Run
   `npm run test:rules` and `npm run bench`."*
3. Add a realistic bench case if the class isn't covered yet.
4. Merge only if rule tests pass and the bench gate holds.

### Definition of done
- Typecheck, unit tests, rule tests pass (`npm run check`).
- Bench gate passes and `bench/results/latest.json` is committed with the change.
- Docs updated if behavior or CLI changed.

## 6. Cost control for the AI layer (step 6)
Claude Pro/Max pays for *building*; the product's AI calls use the Claude API (billed per token).
- Triage only new fingerprints; cache verdicts forever per fingerprint + rule version.
- Default triage on a small model; escalate to a larger model only for `needs_review` and fixes.
- Send minimal context (taint path slice, not whole files).
- Offer bring-your-own-API-key for teams.

## 7. Risks we watch
- **Accuracy drift** from AI-written rules → bench gate.
- **Our own security** → no stored source code, minimal GitHub App permissions, secret redaction.
  Anything that ever runs server-side (pentest agent, hosted fix runs): a fresh sandbox per job,
  per-customer encryption keys, no training on customer data, written retention policy.
- **Scope creep** → breadth is the goal, so the guard is the order above plus the quality bar: a
  category ships only when pinned, normalized, benchmarked and quiet. Finish a step before starting the next.
- **Licensing** → we do not ship Semgrep's official rule registry (its license forbids competing
  SaaS use); all rules in `rules/` are written by us. Check each engine's license before wrapping it
  (e.g. MobSF is GPL-3). Get a legal check before launch.
