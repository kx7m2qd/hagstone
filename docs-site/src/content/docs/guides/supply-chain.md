---
title: Supply-chain risk
description: Catch packages that don't exist, typosquats, brand-new releases, install scripts and known-malicious packages.
---

A vulnerability database only knows about attacks after they've been reported. Hagstone's built-in `pkgrisk` engine also looks for the signs of an attack that hasn't been reported yet. It covers **npm and PyPI**.

## Checks

| Rule | What it means | Severity |
|---|---|---|
| `pkg-known-malicious` | The package version has an OpenSSF malicious-package advisory (`MAL-…`). Remove it now and treat the machine that installed it as compromised. Can't be baselined or suppressed. | critical |
| `pkg-nonexistent` | A direct dependency doesn't exist on the registry. Often a name an AI assistant made up; an attacker can register it. | critical |
| `pkg-typosquat` | The name is one typo away from a popular package (`reqeusts` → `requests`, `crossenv` → `cross-env`). | high |
| `pkg-new-package` | The package was first published less than 30 days ago. | high |
| `pkg-new-version` | The version you resolved was published less than 72 hours ago. Most hijacked releases are caught and pulled within that window. | medium |
| `pkg-install-script` | An npm package runs a script when it's installed. | medium |
| `pkg-sdist-only` | A PyPI release has no wheel, so its `setup.py` runs when it's installed. | medium |

Install scripts are common and usually fine (esbuild and sharp use them), so they're only reported **together with** another signal, or for a direct dependency that isn't a popular package. Otherwise you get one count line, such as *"pkgrisk: 12 dependencies run install scripts (not reported individually)"*.

## Files read

| Ecosystem | Files |
|---|---|
| npm | `package.json`, `package-lock.json` (lockfile v2 and v3) |
| PyPI | `requirements*.txt`, `pyproject.toml` (`[project] dependencies`) |

`yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `Pipfile` and `uv.lock` aren't read by these checks yet; the report says when it skipped one. Their packages are still checked for known vulnerabilities and known-malicious advisories by [OSV-Scanner](/docs/guides/dependencies/).

Private packages aren't looked up on the public registries: npm packages under a scope that `.npmrc` points at a private registry (`@acme:registry=…`), and every package in a requirements file that sets `--index-url` or `--extra-index-url`. So internal package names never leave your network, and a private package is never reported as "doesn't exist". If a private name **also** exists publicly, Hagstone warns you: that's the setup for a dependency-confusion attack.

## Network and `--offline`

The registry checks send **package names and versions** to `registry.npmjs.org` and `pypi.org`. With `--offline`, the registry checks are skipped: typosquat and install-script checks still run (they need no network), and known-malicious packages still come from OSV-Scanner's offline database. The checks that need live registry data (`pkg-nonexistent`, `pkg-new-package`, `pkg-new-version`, `pkg-sdist-only`) are skipped.

If the registry can't be reached, Hagstone warns instead of failing, and reports nothing it couldn't check.

## Check a single package

From a coding agent, use the [`check_package` tool](/docs/guides/coding-agents/#check_package).
