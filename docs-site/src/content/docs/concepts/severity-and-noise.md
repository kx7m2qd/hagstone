---
title: Severity and noise
description: How severity and confidence are set, and everything Hagstone does by default to keep the list short.
---

## Severity

| Severity | Meaning | Examples |
|---|---|---|
| `critical` | Exploitable from outside with little effort; full compromise of data or the server. | SQL injection, command injection, a leaked cloud key, a malicious package |
| `high` | Serious, usually exploitable. | XSS, path traversal, SSRF, a dependency with a high-severity advisory, a public bucket |
| `medium` | Real, but needs more conditions to exploit, or limits damage less. | Weak hashing for passwords, a missing auth check on a non-admin route |
| `low` | Worth fixing when you're in the file. | |
| `info` | Context, not a problem on its own. | |

Code rule severities are set per rule (see the [catalogue](/docs/reference/rules/)). Dependency severity is the worst advisory's. IaC severity is Trivy's.

## Confidence

How sure a rule is that a match is a real issue:

- **`high`**: the rule follows untrusted input from where it enters to where it's used, and stops at sanitizers. Rarely wrong.
- **`medium`**: a risky pattern in a context that's usually dangerous.
- **`low`**: a pattern that's sometimes fine. Worth a look.

## The gate

`--fail-on <severity>` fails the scan (exit `1`) when any reported finding is at least that severe. Default: `high`. `none` never fails on findings.

## What's quiet by default

Each of these is counted in the report, so nothing disappears silently.

### Unused dependencies are lowered

A vulnerable npm or PyPI package that nothing imports, or only tests and dev tooling import, is shown one severity level lower. The gate still uses the **original** severity, unless you pass `--trust-reachability`. [Reachability](/docs/guides/dependencies/#reachability) explains how it's worked out.

### Test and example code

Code and dependency findings in test and example code are hidden. A path counts as test or example code when:

- a folder in it is named like `test`, `tests`, `__tests__`, `spec`, `e2e`, `fixtures`, `mocks`, `testdata`, `examples`, `samples`, `demo` or `playground`;
- or the file is named like `*.test.ts`, `*.spec.js`, `*.stories.tsx`, `test_*.py`, `*_test.py`, `conftest.py`, `UserServiceTest.java` or `OrderIT.java`.

**Secrets and malicious packages are always shown**, wherever they are: a key in a test file is still a leaked key. `--include-tests` shows everything.

### IaC hardening

Infrastructure checks that don't expose anything on their own are hidden. `--include-hardening` shows them. [Details](/docs/guides/infrastructure-as-code/#exposure-first-hardening-hidden).

### Install scripts

Reported only alongside another supply-chain signal. [Details](/docs/guides/supply-chain/).

### Grouping

One finding per package to upgrade, not one per advisory. For container images, one per source package.

### Your baseline

Once you've [baselined](/docs/guides/existing-codebase/), only new findings, and old ones that got worse, are reported.

## See everything

```sh
hagstone scan . --include-tests --include-hardening --no-reachability --no-baseline --fail-on none
```
