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
| A name starting with `/`, such as `/out/` or `/notes.md` | That file or folder at the root only. |

There are no wildcards. Patterns are compared to paths relative to the scanned folder.

## Always skipped

These are skipped in every scan, at any depth, without listing them:

- dependencies: `node_modules/`, `vendor/`, `.venv/`, `venv/`;
- build output: `dist/`, `build/`, `.next/`, `.nuxt/`, `.output/`, `.svelte-kit/`, `.angular/`, `.vercel/`, `.netlify/`;
- caches: `.cache/`, `.turbo/`, `.parcel-cache/`, `__pycache__/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.tox/`, `coverage/`, `.nyc_output/`;
- `.git/` and `.hagstone/`.

## Gitignored files

In a git repository, files that git ignores **and doesn't track** are skipped too: `.env.local`, local build output, caches. They are never committed, so a key in `.env.local` is where it belongs, not a leak. The summary line counts the findings left out, and `--include-gitignored` shows them.

A file that's tracked is always scanned, even if a `.gitignore` rule matches it, so `.gitignore` can't hide committed code. Outside a git repository, only the folders above are skipped.

## What it applies to

Findings in ignored paths are dropped for every engine, and the code, IaC, license and supply-chain engines don't read those files at all. The pre-commit hook uses the `.hagstoneignore` that's staged in the commit.

## Ignore a path vs. hide tests vs. suppress a finding

| You want to | Use |
|---|---|
| Never scan a folder (vendored code, generated files) | `.hagstoneignore` |
| Not see findings in tests and examples | Nothing: [hidden by default](/docs/concepts/severity-and-noise/#test-example-and-dev-script-code). |
| Accept or dismiss one specific finding | [`hagstone suppress`](/docs/guides/suppressing-findings/) |

Don't ignore application code to make a finding go away: suppress the finding, with a reason, so the rest of the file is still scanned.

## In CI

An ignore file in the pull request could un-scan the code that pull request adds, so the GitHub Action uses the base branch's copy. On other CI systems, pass it with `--ignore-file`. See [Add it to CI](/docs/getting-started/ci/#dont-let-a-pull-request-hide-its-own-findings).
