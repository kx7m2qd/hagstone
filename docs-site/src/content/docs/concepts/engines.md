---
title: Engines and verification
description: Which engines Hagstone runs, why, and how every binary is pinned and verified.
---

Hagstone doesn't reinvent proven scanners. It runs them with safe settings, verifies them, and turns their output into one consistent, quiet report. The exact versions are listed in [Engine versions](/docs/reference/engine-versions/).

| Engine | Job | Why this one |
|---|---|---|
| [Opengrep](https://github.com/opengrep/opengrep) | Code analysis with Hagstone's taint rules | Open-source fork of Semgrep's engine, with cross-function and cross-file taint. |
| [OSV-Scanner](https://github.com/google/osv-scanner) | Dependency vulnerabilities | Google's scanner over the OSV database, which aggregates GitHub, PyPA, npm, Go, RustSec and more. |
| [Gitleaks](https://github.com/gitleaks/gitleaks) | Secrets | Fast, widely used, and broad rule coverage. |
| [Trivy](https://github.com/aquasecurity/trivy) | Infrastructure as code | Covers Terraform, Kubernetes, Dockerfile, Helm, CloudFormation, ARM and Ansible in one binary. |
| [Syft](https://github.com/anchore/syft) | Licenses, SBOMs, image catalogue | The standard SBOM generator, CycloneDX and SPDX. |
| [Grype](https://github.com/anchore/grype) | Container image vulnerabilities | Matches Syft's catalogue, so the SBOM and the findings agree, and it finds OS packages that source-keyed databases miss. |
| `pkgrisk` | Supply-chain risk | Written in Hagstone (TypeScript), so there's no binary. |

## How binaries are verified

**Pinned by version and SHA-256.** Every engine is pinned to an exact version and the SHA-256 of its release archive, for each supported platform, in [`src/engines/manifest.ts`](https://github.com/kx7m2qd/hagstone/blob/main/src/engines/manifest.ts). Hagstone never downloads "latest".

**Checked on download and on every run.** A download that doesn't match is refused. The extracted binary's hash is checked again before every scan, so a cached binary that's been replaced is refused too.

**Pins checked against upstream signatures.** When a pin changes, CI verifies it against the project's own signature: Sigstore signatures (Opengrep, Trivy, Syft, Grype), SLSA build provenance (OSV-Scanner), or the published checksums file (Gitleaks, which publishes no signature). The signature must come from the project's release workflow at the release tag's commit.

**Downloads are bounded.** Each download has a size limit, and archives are extracted into a private temporary folder.

Pinning by hash is what protects you when an upstream release is compromised. In March 2026 a stolen token was used to publish a malicious Trivy release and move the `trivy-action` tags. A scanner that installs "latest" would have run it; a pinned one can't.

## Using your own engine binaries

On a platform without pinned builds, or to use a binary your organisation has vetted, point Hagstone at it:

```sh
export HAGSTONE_OPENGREP_BIN=/opt/tools/opengrep
export HAGSTONE_OSV_SCANNER_BIN=/opt/tools/osv-scanner
```

The variable is `HAGSTONE_<ENGINE>_BIN`, with dashes as underscores. Use the exact version in [Engine versions](/docs/reference/engine-versions/): output formats change between versions. Hagstone can't verify these binaries and warns on every scan.

## Updating engines

Engine versions change only with a Hagstone release, after the new version passes every benchmark gate. Upgrade Hagstone to get them.
