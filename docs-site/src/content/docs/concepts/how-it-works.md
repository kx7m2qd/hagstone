---
title: How it works
description: What happens between typing hagstone scan and seeing the report.
---

```text
 your project ──► .hagstoneignore + default ignores
                      │
      ┌───────────────┼──────────────────────────────────────────────┐
      ▼               ▼             ▼          ▼          ▼          ▼
   Opengrep      OSV-Scanner    Gitleaks    pkgrisk     Trivy      Syft
   code rules    dependencies   secrets     supply      IaC        licenses
      │               │             │        chain        │          │
      └───────────────┴─────────────┴──────────┴──────────┴──────────┘
                                     │  normalize: one Finding format,
                                     │  secrets redacted, stable ids
                                     ▼
            ignores → reachability → test scope → baseline → --fail-on
                                     │
                                     ▼
                          text · JSON · SARIF · exit code
```

## 1. Engines run in parallel

Each engine is a pinned, checksum-verified binary (except `pkgrisk`, which is part of Hagstone). They run at the same time, each with **Hagstone's own configuration**, never the scanned repository's: a repository can't ship a config file that turns checks off. One engine failing doesn't hide the others' results; the scan reports what failed and exits `2`.

## 2. Everything becomes one finding format

Every engine's output is turned into the same [`Finding`](/docs/reference/output-formats/#findings): category, rule, severity, confidence, location, CWE, OWASP category, and a message that says what is wrong, why it matters and how to fix it. Secret values are redacted at this step, before anything is printed, written or sent.

Each finding gets a stable **fingerprint** `id`. It doesn't include the line number, so a finding keeps its id when code above it moves. That's what makes [baselines](/docs/guides/existing-codebase/) and code scanning alerts stable.

## 3. Filters, in order

1. **Ignored paths** are dropped ([`.hagstoneignore`](/docs/guides/ignoring-paths/)).
2. **Reachability** is worked out for vulnerable npm and PyPI packages, and unused ones are shown one level lower ([details](/docs/guides/dependencies/#reachability)).
3. **Test and example code** findings are hidden and counted.
4. **The baseline** hides known findings and brings back any that got worse.
5. **The gate** compares what's left to `--fail-on`.

## 4. Report

Text for people, JSON for scripts, SARIF for code scanning tools. The exit code is the gate result.

## The code rules

Hagstone's code rules are written for Opengrep and live in [`rules/`](https://github.com/kx7m2qd/hagstone/tree/main/rules). The `high` confidence rules use **taint tracking**: they follow data from where an attacker controls it (a request parameter, a header, an uploaded file) to where it does harm (a SQL query, a shell command, an HTML response), and stop at sanitizers (parameterized queries, escaping, an `int()` conversion). For Java, the taint follows calls into helper methods in other files.

Every rule has a test file with flagged and safe examples, and the whole set is measured against benchmarks on every change. See [Accuracy](/docs/concepts/accuracy/) and the [rule catalogue](/docs/reference/rules/).
