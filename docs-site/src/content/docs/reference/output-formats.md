---
title: Output formats
description: The text, JSON and SARIF reports, field by field.
---

```sh
hagstone scan . --format text     # default
hagstone scan . --format json --output hagstone.json
hagstone scan . --format sarif --output hagstone.sarif
```

## Text

For people. Findings sorted by severity, then file. Colour is used when writing to a terminal. See [Reading a finding](/docs/getting-started/first-scan/#reading-a-finding).

## JSON

The complete scan result. Use it for scripts, dashboards and custom gates.

```json
{
  "root": "/home/dev/blog",
  "findings": [
    {
      "id": "fa2d2db5d3f89db15bfe44712c145f48",
      "category": "code",
      "engine": "opengrep",
      "ruleId": "py-sql-injection",
      "title": "SQL injection",
      "message": "Request data is formatted into a SQL string (f-string, `%`, `+` or `.format`). An attacker can rewrite the query to read or modify any data. Pass values as parameters: …",
      "severity": "critical",
      "confidence": "high",
      "location": {
        "path": "app.py",
        "startLine": 12,
        "endLine": 12,
        "startColumn": 17,
        "snippet": "cur.execute(f\"SELECT id, title FROM posts WHERE title LIKE '%{term}%'\")"
      },
      "cwe": ["CWE-89"],
      "owasp": ["A03:2021 - Injection"],
      "dataflow": [
        { "path": "app.py", "line": 10, "snippet": "request.args" },
        { "path": "app.py", "line": 10, "snippet": "term" },
        { "path": "app.py", "line": 12, "snippet": "f\"SELECT id, title FROM posts WHERE title LIKE '%{term}%'\"" }
      ]
    }
  ],
  "ignores": [],
  "warnings": [],
  "engines": [{ "engine": "opengrep", "ok": true, "findings": 1, "ms": 2950 }],
  "hiddenInTests": 0
}
```

### Scan result

| Field | Type | Meaning |
|---|---|---|
| `root` | string | Absolute path of the scanned folder. |
| `findings` | Finding[] | Reported findings, after every filter. |
| `ignores` | string[] | Patterns from the repository's own `.hagstoneignore`. Shown because a change to them can hide findings. |
| `warnings` | string[] | Things you should know: hidden counts, skipped files, unverified binaries, registry errors. |
| `engines` | object[] | Per engine: `engine`, `ok`, `findings`, `ms`, and `error` when `ok` is `false`. |
| `hiddenInTests` | number | Findings hidden because they're in test or example code. |
| `suppressed` | Finding[] | Present with a baseline: findings it hid, each with `suppression`. |
| `baseline` | object | Present with a baseline: `file`, `baselined`, `suppressed`, `resurfaced`, and `stale` entries after a complete scan. |

### Findings

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable fingerprint. Doesn't change when lines move; changes when the issue changes. |
| `category` | string | `code`, `dependency`, `secret`, `iac` or `license`. |
| `engine` | string | `opengrep`, `osv-scanner`, `gitleaks`, `pkgrisk`, `trivy`, `syft` or `grype`. |
| `ruleId` | string | The rule. Code rules are in the [catalogue](/docs/reference/rules/). |
| `title` | string | Short description. |
| `message` | string | What's wrong, why it matters, how to fix it. |
| `severity` | string | `critical`, `high`, `medium`, `low` or `info`. |
| `confidence` | string? | `high`, `medium` or `low`. |
| `location` | object | `path` (relative, forward slashes), `startLine`, optional `endLine`, `startColumn`, `snippet`. Secrets are redacted in `snippet`; IaC findings have none. |
| `cwe` | string[] | For example `["CWE-89"]`. |
| `owasp` | string[] | OWASP Top 10 (2021) categories. |
| `dependency` | object? | `name`, `version`, `ecosystem`, `advisories` (ids), `fixedVersions`. |
| `reachability` | object? | npm and PyPI vulnerable dependencies: `status` (`reachable`, `dev-only`, `unreachable`, `unknown`), `reason`, optional `evidence` (`path`, `line`) and `originalSeverity` if it was lowered. |
| `dataflow` | object[]? | Taint findings: each step from source to sink, with `path`, `line` and `snippet`. |
| `scope` | string? | `test` or `example` when the file is test or example code (only visible with `--include-tests`). |
| `suppression` | object? | In `suppressed` only: `kind`, `reason`, `date`, `expires`. |
| `resurfaced` | string? | Why a baselined finding is reported again. |

The format is stable within a major version. New optional fields may be added in minor versions.

## SARIF

[SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html), for GitHub code scanning and any other SARIF viewer.

| SARIF | From |
|---|---|
| `level` | `critical` and `high` → `error`, `medium` → `warning`, `low` and `info` → `note`. |
| rule `properties.security-severity` | `9.5`, `8.0`, `5.5`, `3.0`, `0.0`, so GitHub shows Critical / High / Medium / Low. |
| rule `properties.tags` | `security`, the category, and `external/cwe/cwe-NNN`. |
| `partialFingerprints["hagstone/v1"]` | The finding `id`, so alerts track the same issue across commits. |
| `codeFlows` | The dataflow steps of taint findings. |
| result `properties` | `severity`, plus `reachability`, `reachabilityReason`, `originalSeverity` and `resurfaced` when set. |

Baselined and suppressed findings are left out of SARIF, so their alerts close.
