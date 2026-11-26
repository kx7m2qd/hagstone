---
title: Ignoring paths
description: Exclude vendored code, generated files and fixtures from every scan with .hagstoneignore.
---

Create `.hagstoneignore` at the root of the scanned folder. Each line is one pattern; lines starting with `#` are comments.

```text
# Third-party code we don't maintain
third_party/
static/js/vendor.min.js

# Intentionally vulnerable training material, at any depth
fixtures
```

## Pattern rules

| Pattern | Matches |
|---|---|
| A path with a `/` inside it, such as `static/js/` or `docs/legacy.py` | Anything whose path from the root **starts with** it. |
| A bare name, such as `fixtures` or `fixtures/` | A file or folder with exactly that name, **at any depth**. |

There are no wildcards. Patterns are compared to paths relative to the scanned folder.

## Always skipped

These are skipped in every scan, without listing them: `node_modules/`, `.git/`, `dist/`, `build/`, `vendor/`, `.venv/`, `venv/`, `__pycache__/` and `.hagstone/`.

## What it applies to

Findings in ignored paths are dropped for every engine, and the code, IaC, license and supply-chain engines don't read those files at all. The pre-commit hook uses the `.hagstoneignore` that's staged in the commit.

## Ignore a path vs. hide tests vs. suppress a finding

| You want to | Use |
|---|---|
| Never scan a folder (vendored code, generated files) | `.hagstoneignore` |
| Not see findings in tests and examples | Nothing: [hidden by default](/docs/concepts/severity-and-noise/#test-and-example-code). |
| Accept or dismiss one specific finding | [`hagstone suppress`](/docs/guides/suppressing-findings/) |

Don't ignore application code to make a finding go away: suppress the finding, with a reason, so the rest of the file is still scanned.

## In CI

An ignore file in the pull request could un-scan the code that pull request adds, so the GitHub Action uses the base branch's copy. On other CI systems, pass it with `--ignore-file`. See [Add it to CI](/docs/getting-started/ci/#dont-let-a-pull-request-hide-its-own-findings).
