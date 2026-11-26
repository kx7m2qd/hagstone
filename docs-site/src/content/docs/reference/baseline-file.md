---
title: Baseline file
description: The format of .hagstone/baseline.json, how entries match findings, and when they come back.
---

`.hagstone/baseline.json` is written by `hagstone baseline create`, `baseline prune` and `suppress`. It's meant to be committed and reviewed. You can edit it by hand (for example, to delete a decision), but let the commands write it.

## Format

```json
{
  "schema": 1,
  "hagstoneVersion": "0.6.0",
  "entries": [
    {
      "id": "fa2d2db5d3f89db15bfe44712c145f48",
      "kind": "accepted-risk",
      "engine": "opengrep",
      "category": "code",
      "ruleId": "py-sql-injection",
      "path": "app.py",
      "severity": "critical",
      "date": "2026-11-26",
      "reason": "admin-only tool, fix in Q1",
      "expires": "2027-02-24",
      "excerpt": "cur.execute(f\"SELECT id, title FROM posts WHERE title LIKE '%{term}%'\")",
      "codeHash": "…"
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `schema` | File format version. A file with an unknown schema is ignored with a warning. |
| `hagstoneVersion` | The version that last wrote the file. |
| `id` | The finding's fingerprint. |
| `kind` | `baseline` (snapshot), `false-positive` or `accepted-risk`. |
| `engine`, `category`, `ruleId`, `path` | What and where, for people reading the file. |
| `severity` | The severity when recorded, before reachability lowered it. |
| `reachability` | Dependencies: the reachability status when recorded. |
| `date` | When the entry was written. |
| `reason` | Required for `false-positive` and `accepted-risk`. |
| `expires` | `accepted-risk` only. |
| `excerpt` | Code findings: the flagged line, up to 120 characters, as shown in reports (secret values are already redacted there). Never present for secrets. |
| `codeHash` | Code findings: a hash of the rule and the normalized code, used to follow code that moves. |
| `dependency` | Dependency findings: ecosystem, name, version and the advisories known when recorded. |

There's no author field: `git blame` has it, and it keeps personal data out of the file. Entries are sorted by `id`, so diffs stay small.

## Matching

Each entry matches at most one finding:

1. **Same `id`.**
2. Code findings: **same `codeHash`**, so a renamed file or moved function still matches.
3. Dependency findings: **same engine, ecosystem, name and version**.
4. Secrets: **only the exact `id`**, and only for `false-positive` entries.

Entries for known-malicious packages are ignored.

## Resurfacing

A matched finding is reported again, with the reason, and counts toward `--fail-on`, when:

- an `accepted-risk` entry has expired;
- a dependency has an advisory that isn't in the entry;
- the severity is now higher than the entry's;
- a dependency recorded as unreachable or dev-only is now reachable.

## Stale entries

An entry that matches no finding is stale (the finding was fixed). Stale entries are reported as a warning, never a failure, and only after a complete scan. `hagstone baseline prune` removes them.

## In reports

- **Text:** one line such as `214 baselined, 3 suppressed not shown; --no-baseline to show`.
- **JSON:** hidden findings are in `suppressed`, each with a `suppression` field; counts are in `baseline`.
- **SARIF:** hidden findings are left out, so their code scanning alerts close; the counts are in `runs[0].properties.hagstone`.
