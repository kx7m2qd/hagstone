---
title: Vulnerable dependencies
description: How Hagstone finds vulnerable packages, groups advisories, and ranks them by whether your code uses them.
---

Hagstone runs [OSV-Scanner](https://github.com/google/osv-scanner) over your manifests and lockfiles and checks every package version against the [OSV database](https://osv.dev), which aggregates GitHub, PyPA, npm, Go, RustSec and other advisory sources.

## One finding per package to upgrade

A package with five advisories is one finding, not five. The finding lists each advisory with its severity, and the version that fixes all of them:

```text
HIGH     flask 2.0.1 has 2 known vulnerabilities
         requirements.txt:1  osv-scanner/vulnerable-dependency  CWE-539,CWE-524
         reach: reachable  flask is imported at app.py:8.
         flask@2.0.1 (PyPI) is affected by 2 advisories: PYSEC-2023-62 (high); PYSEC-2026-2151 (medium). Upgrade to 3.1.3 or later to fix all 2.
```

The severity is that of the worst advisory.

## Reachability

For **npm and PyPI**, Hagstone checks whether your code actually imports each vulnerable package:

| Status | Meaning | Effect |
|---|---|---|
| `reachable` | Your code imports it, or imports a package that pulls it in, or names it in tooling (scripts, Dockerfile, CI). The finding names the file and line. | None. |
| `dev-only` | Only dev dependencies pull it in, or only tests and dev tooling use it. It isn't part of what you ship. | Shown one severity level lower. |
| `unreachable` | The lockfile's dependency graph shows nothing that pulls it in is used. | Shown one severity level lower. |
| `unknown` | Hagstone can't tell: no readable dependency graph, dynamic imports, a library that loads packages by name, or a project too large to read completely. | None. |

Hagstone reads your files to decide, and never runs them. Every rule leans towards `reachable` or `unknown`, because a wrong `unreachable` would hide real risk. The message always gives the reason, for example *"flask is imported at app.py:8."*

**Lowering is for display only by default.** `--fail-on` still uses the original severity, so a critical vulnerability fails the build even if nothing imports it. Two flags change that:

```sh
hagstone scan . --trust-reachability   # --fail-on uses the lowered severity
hagstone scan . --reachable-only       # also hide unreachable findings entirely
hagstone scan . --no-reachability      # skip the check
```

Reachability is **import-level**: it tells you whether your code loads the package, not whether it calls the vulnerable function. A `reachable` finding may still not be exploitable in your code; an `unreachable` one is very unlikely to be.

Known-malicious packages are never lowered: their install scripts run whether or not anything imports them.

## What's scanned

Everything OSV-Scanner supports, including `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `requirements.txt`, `poetry.lock`, `Pipfile.lock`, `uv.lock`, `pom.xml`, `gradle.lockfile`, `go.mod`, `Cargo.lock`, `Gemfile.lock` and `composer.lock`. Lockfiles give exact versions; a bare manifest gives whatever it pins.

Hagstone runs OSV-Scanner with its own configuration, so a repository's `osv-scanner.toml` can't hide vulnerabilities. It doesn't resolve transitive dependencies over the network or run your build scripts.

## Network

Package names and versions are sent to the OSV API at `api.osv.dev`. No source code or file contents are sent. To send nothing, download the databases once with `hagstone offline-db` and scan with `--offline`: see [Offline](/docs/guides/offline/). See [What leaves your machine](/docs/concepts/what-leaves-your-machine/).

## Fixing

Upgrade to the version in the message. If you can't upgrade yet, record the decision so it stops failing the gate until a date:

```sh
hagstone suppress requirements.txt:1 --as accepted-risk --reason "upgrade blocked on Flask 3 migration" --expires 2027-01-31
```

A suppressed or baselined dependency finding comes back if a **new** advisory is published for that version, or if it becomes reachable.
