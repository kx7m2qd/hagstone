---
title: CLI reference
description: Every Hagstone command and flag, with defaults and examples.
---

```text
hagstone <command> [options]
```

The exact `--help` text for this version is on [--help output](/docs/reference/help/).

## `hagstone scan [path]`

Scans a directory (default `.`) for code, dependency, secret, supply-chain, IaC and license issues, or a container image with `--image`.

### Output

| Flag | Default | Description |
|---|---|---|
| `--format text\|json\|sarif` | `text` | Report format. See [Output formats](/docs/reference/output-formats/). |
| `--output <file>` | stdout | Write the report to a file. A one-line summary goes to stderr. |

### Gate

| Flag | Default | Description |
|---|---|---|
| `--fail-on <severity\|none>` | `high` | Exit `1` if any reported finding is at least this severe: `critical`, `high`, `medium`, `low`, `info`. `none` never fails on findings. |

### What runs

| Flag | Default | Description |
|---|---|---|
| `--engines <list>` | all | Comma-separated subset of `opengrep`, `osv-scanner`, `gitleaks`, `pkgrisk`, `trivy`, `syft`. |
| `--no-install` | | Fail instead of downloading a missing engine. |
| `--offline` | | Send nothing over the network. Dependency vulnerabilities are matched against the databases from `hagstone offline-db` (the scan fails if one is missing); npm and PyPI lookups are skipped; image scans use the cached database. See [Offline](/docs/guides/offline/). |

### What's shown

| Flag | Default | Description |
|---|---|---|
| `--no-reachability` | | Skip the reachability check for npm and PyPI dependencies. |
| `--trust-reachability` | | Let `--fail-on` use the lowered severity of unreachable and dev-only dependencies. |
| `--reachable-only` | | Hide unreachable dependency findings. Implies `--trust-reachability`. |
| `--include-tests` | | Also report code and dependency findings in test and example code. |
| `--include-hardening` | | Also report IaC hardening checks. |
| `--no-baseline` | | Ignore the baseline: report and gate on every finding. |

### Files

| Flag | Default | Description |
|---|---|---|
| `--ignore-file <file>` | `<path>/.hagstoneignore` | Read ignore patterns from this file. |
| `--baseline <file>` | `<path>/.hagstone/baseline.json` | Apply this baseline. A missing file means none. |
| `--license-policy <file>` | `<path>/.hagstone/licenses.json` | Apply this license policy. A missing file means the defaults. |

### Images

| Flag | Description |
|---|---|
| `--image <ref>` | Scan a container image instead of a directory: `alpine:3.20`, `registry:ghcr.io/org/app:1.2`, `docker:app:dev`, `oci-archive:app.tar`. Works with `--format`, `--output`, `--fail-on`, `--baseline` and `--offline`. |
| `--dockerfile <file>` | With `--image`: point findings at this Dockerfile's final `FROM` line. |

### Examples

```sh
hagstone scan                                      # current folder, text report, fail on high
hagstone scan services/api --fail-on critical
hagstone scan . --format sarif --output hagstone.sarif
hagstone scan . --engines opengrep,gitleaks        # code and secrets only
hagstone scan --image docker:my-app:dev --dockerfile Dockerfile
```

## `hagstone sbom [path]`

Writes an SBOM of the project's shipped dependencies, or of an image. See [SBOM and licenses](/docs/guides/sbom-and-licenses/).

| Flag | Default | Description |
|---|---|---|
| `--format cyclonedx\|spdx` | `cyclonedx` | CycloneDX JSON or SPDX JSON. |
| `--output <file>` | stdout | Where to write it. |
| `--image <ref>` | | SBOM of an image instead of a directory. |
| `--offline` | | Skip the PyPI license lookups. |

## `hagstone baseline create [path]`

Records every current finding in `.hagstone/baseline.json`, except secrets and known-malicious packages. Refuses if the file exists, or if any engine failed. See [Adopt it on an existing codebase](/docs/guides/existing-codebase/).

| Flag | Description |
|---|---|
| `--force` | Re-snapshot an existing baseline. Keeps your `false-positive` and `accepted-risk` decisions, and says how many new findings were absorbed. |

## `hagstone baseline prune [path]`

Removes entries for findings that no longer exist, and updates entries whose code moved. Refuses if any engine failed.

## `hagstone suppress <id|path:line>`

Records a decision about one finding in the baseline file. See [Suppressing findings](/docs/guides/suppressing-findings/).

| Flag | Required | Description |
|---|---|---|
| `--as false-positive\|accepted-risk` | yes | The kind of decision. Secrets can only be `false-positive`. |
| `--reason "…"` | yes | Why. Kept in the file. |
| `--expires YYYY-MM-DD` | | For `accepted-risk`. Default: 90 days from today. |
| `--path <path>` | | The scan root (default `.`). |

## `hagstone offline-db [path]`

Downloads OSV's vulnerability database for each ecosystem the project at `path` (default `.`) uses, into `$HAGSTONE_HOME/osv-db`, for `--offline` scans. Sends nothing about your packages. Run it again to update. See [Offline](/docs/guides/offline/).

| Flag | Description |
|---|---|
| `--no-install` | Fail instead of downloading OSV-Scanner if it's missing. |

## `hagstone engines install`

Downloads and verifies every pinned engine for this platform. Useful to warm a CI cache, or before going offline.

## `hagstone engines status`

Shows each engine, its pinned version, and the path of the installed binary:

```text
opengrep     1.30.1   /Users/you/.cache/hagstone/engines/opengrep/1.30.1/opengrep
osv-scanner  2.6.0    /Users/you/.cache/hagstone/engines/osv-scanner/2.6.0/osv-scanner
gitleaks     8.30.1   /Users/you/.cache/hagstone/engines/gitleaks/8.30.1/gitleaks
…
```

## `hagstone hook install`

Installs the git pre-commit hook in the repository you're in. See [Pre-commit hook](/docs/guides/pre-commit-hook/).

| Flag | Description |
|---|---|
| `--force` | Replace an existing hook, keeping it as `pre-commit.hagstone-backup`. |

## `hagstone hook uninstall`

Removes the hook if Hagstone wrote it, and restores the backup.

## `hagstone hook run`

What the hook calls. Scans staged changes with Opengrep and Gitleaks and reports findings on added lines.

| Flag | Default | Description |
|---|---|---|
| `--fail-on <severity\|none>` | `high` | Block at this severity. Secrets always block. |

## `hagstone mcp [path]`

Starts the MCP server on stdio, confined to `path` (default `.`). See [Coding agents](/docs/guides/coding-agents/).

## `hagstone test-rules`

Runs the rule test suite in `rules/`. For people writing or changing rules.

## `hagstone --version`, `hagstone --help`

Print the version, or the full help text.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | No reported finding is at or above `--fail-on`. |
| `1` | At least one reported finding is at or above `--fail-on`. For `hook run`: the commit is blocked. |
| `2` | Usage error, or an engine failed or is missing. The scan is incomplete, so it doesn't pass. |
