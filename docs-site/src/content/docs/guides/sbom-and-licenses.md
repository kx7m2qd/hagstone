---
title: SBOM and licenses
description: Write a CycloneDX or SPDX SBOM, and flag dependencies whose license conflicts with how you ship.
---

## Write an SBOM

```sh
hagstone sbom . --output sbom.cdx.json                    # CycloneDX JSON (default)
hagstone sbom . --format spdx --output sbom.spdx.json     # SPDX JSON
hagstone sbom --image registry:ghcr.io/org/app:1.2 --output image.cdx.json
```

Without `--output`, the SBOM is written to stdout. It's [Syft](https://github.com/anchore/syft)'s SBOM, unchanged, so any tool that reads CycloneDX or SPDX can use it.

The SBOM lists what you **ship**: dev dependencies are left out. Syft runs with Hagstone's own configuration: it doesn't run your build tools (such as `go`) or fetch from Maven or Go proxies. The only network lookup is license metadata for Python packages on `pypi.org`, by package name; `--offline` turns it off.

## License checks

Every `hagstone scan` also checks dependency licenses. By default:

| Rule | Licenses | Severity | Why it matters |
|---|---|---|---|
| `license-network-copyleft` | AGPL, SSPL | high | You must publish your own source to anyone who uses the software over a network, which covers most web services. |
| `license-non-commercial` | CC-BY-NC, BUSL, Elastic-2.0, Commons Clause, PolyForm-Noncommercial | high | Commercial use is forbidden or restricted. |
| `license-copyleft` | GPL (not LGPL, and not GPL with a linking exception such as Classpath) | medium | Software you distribute with it must be GPL too. Fine for internal and server-side use; a problem for anything you ship to customers. |
| `license-denied` | Anything in your policy's `deny` list | high | Your policy says so. |

Licenses are matched by SPDX id **and** by the names registries really use ("GNU General Public License v2 (GPLv2)"). For `A OR B` you get to choose, so it's only a finding if every option is a problem. For `A AND B`, every part applies.

Packages with no license data are counted in one warning, not reported.

## Your license policy

Create `.hagstone/licenses.json` and commit it:

```json
{
  "allow": ["GPL-2.0-only", "GPL-3.0-or-later"],
  "deny": ["WTFPL", "Unlicense"]
}
```

- `allow` turns off the default finding for those licenses (for example, if you only run GPL code on your own servers).
- `deny` adds a `license-denied` finding for any dependency under those licenses.
- Matching ignores case. `allow` wins over `deny`.
- A malformed file produces a warning, and the defaults apply.

To read the policy from somewhere else, use `--license-policy <file>`. In CI, pass the base branch's copy so a pull request can't approve its own license; the [GitHub Action](/docs/guides/github-action/) does this for you.

npm license data comes from `package-lock.json`. Test and example lockfiles are hidden by default, and GitHub Actions used in workflows aren't checked, because they don't ship.
