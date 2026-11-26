---
title: Configuration
description: Every file and environment variable Hagstone reads.
---

Hagstone works with no configuration. Everything below is optional.

## Files in your repository

| File | Purpose | Guide |
|---|---|---|
| `.hagstoneignore` | Paths to skip. | [Ignoring paths](/docs/guides/ignoring-paths/) |
| `.hagstone/baseline.json` | Baselined findings and suppression decisions. Written by `hagstone baseline` and `hagstone suppress`. | [Baseline file](/docs/reference/baseline-file/) |
| `.hagstone/licenses.json` | License policy: `{"allow": [...], "deny": [...]}`. | [SBOM and licenses](/docs/guides/sbom-and-licenses/#your-license-policy) |

Commit all three. In CI, pass the base branch's copies with `--ignore-file`, `--baseline` and `--license-policy` (the GitHub Action does this automatically), so a pull request can't change what's scanned or hidden in the same change.

Hagstone deliberately doesn't read other tools' configuration from the scanned repository: `osv-scanner.toml`, `trivy.yaml`, `.trivyignore`, `.semgrepignore`, `.syft.yaml` and `.grype.yaml` are not used, and `.gitleaksignore` is skipped with a warning. Use Hagstone's own files instead, so every decision is in one reviewed place.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `HAGSTONE_HOME` | `$XDG_CACHE_HOME/hagstone`, or `~/.cache/hagstone` | Where engines and databases are cached. |
| `HAGSTONE_<ENGINE>_BIN` | | Use your own binary for an engine, e.g. `HAGSTONE_OPENGREP_BIN`, `HAGSTONE_OSV_SCANNER_BIN`. Not checksum-verified; every scan warns. See [Engines](/docs/concepts/engines/#using-your-own-engine-binaries). |
| `HAGSTONE_GRYPE_DB_DIR` | `$HAGSTONE_HOME/grype-db` | Where the image vulnerability database is stored. |
| `HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY` | | Proxy for the engines. Add `NODE_USE_ENV_PROXY=1` for Hagstone's own requests. See [Offline and restricted networks](/docs/guides/offline/#proxies). |

## Upgrading from Vigil

Hagstone was called Vigil before 0.2.0. `.vigilignore` and `VIGIL_HOME` are still read when the new names aren't present. Rename them when convenient.
