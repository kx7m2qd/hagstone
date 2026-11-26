---
title: Troubleshooting
description: Fixes for engine downloads, exit code 2, unsupported platforms, slow scans and unexpected results.
---

## The scan exits with code 2

An engine failed or is missing, or a flag was wrong. The report's last lines name the engine and the error. The scan doesn't pass when it's incomplete.

| Message | Fix |
|---|---|
| `<engine> is not installed. Run hagstone engines install.` | You used `--no-install` (or the hook, which never downloads). Run `hagstone engines install`. |
| `<engine> in the cache does not match its pinned checksum.` | The cached binary changed. Run `hagstone engines install` to replace it. If it keeps happening, something on the machine is modifying it: investigate. |
| `Checksum mismatch for <engine> … Refusing to install.` | The download didn't match the pin. Usually a proxy rewriting downloads or a truncated file. Retry; if it persists, report it as a [security issue](/docs/help/security/). |
| `No pinned <engine> build for <platform>.` | See [Unsupported platform](#unsupported-platform). |
| `Downloading <engine>: HTTP 403` or a timeout | GitHub is blocked or rate-limited. See [Offline and restricted networks](/docs/guides/offline/). |

## Unsupported platform

Pinned engine builds exist for **Linux x64** and **macOS arm64**.

- **Windows:** use WSL 2.
- **Intel Mac, Linux arm64:** install each engine yourself at the version in [Engine versions](/docs/reference/engine-versions/), and set `HAGSTONE_<ENGINE>_BIN`. Or run Hagstone in a `linux/amd64` container.

## No dependency findings, but I know there are vulnerable packages

- Check the lockfile isn't in an ignored path, or in a test or example folder (`--include-tests`).
- Without a lockfile, only versions pinned in the manifest can be checked.
- Look for an `osv-scanner` error at the end of the report: it needs to reach `api.osv.dev`, or, with `--offline`, a database from `hagstone offline-db`.
- With `--reachable-only`, unreachable packages are hidden.

## A finding is wrong

[Suppress it](/docs/guides/suppressing-findings/) as a false positive with a reason, and please [open an issue](https://github.com/kx7m2qd/hagstone/issues) with a minimal example. False positives are treated as bugs.

## A finding is missing

- Is it in test or example code? Try `--include-tests`.
- Is it baselined? Try `--no-baseline`.
- IaC: is it a hardening check? Try `--include-hardening`.
- Code: is the language supported (JavaScript/TypeScript, Python, Java)? Is the pattern in the [rule catalogue](/docs/reference/rules/)?

If it should be found, an issue with a minimal example becomes a test case.

## The scan is slow

- The first run downloads engines; image scans download a large database once.
- Most time is the code scan on large repositories. Add generated and vendored folders to [`.hagstoneignore`](/docs/guides/ignoring-paths/).
- In CI, cache `HAGSTONE_HOME` between runs.
- The engine timings are on the last line of the text report.

## `pkgrisk: registry unreachable, N packages not checked`

npm or PyPI couldn't be reached. Those packages weren't checked. Check the network or proxy (`NODE_USE_ENV_PROXY=1`, see [Proxies](/docs/guides/offline/#proxies)), or use `--offline` to skip the lookups on purpose.

## `no offline vulnerability database for <ecosystem>`

You scanned with `--offline` and the project uses an ecosystem whose database isn't downloaded. Run `hagstone offline-db .` with network access. See [Offline](/docs/guides/offline/).

## `the offline <ecosystem> vulnerability database is N days old`

Run `hagstone offline-db .` to update it. Old data misses advisories published since.

## `gitleaks: ignored the repository's .gitleaksignore`

Expected. A scanned repository can't allowlist its own secrets. Mark false positives with `hagstone suppress`.

## The pre-commit hook blocks with exit 2

An engine is missing, and the hook fails closed. Run `hagstone engines install`. To commit anyway, once: `git commit --no-verify`.

## Still stuck

[Open an issue](https://github.com/kx7m2qd/hagstone/issues) with `hagstone --version`, your OS, the command, and the error. Don't paste secrets or private code.
