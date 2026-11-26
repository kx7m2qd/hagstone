---
title: What leaves your machine
description: Every network request Hagstone makes, what's in it, and how to turn it off.
---

**Your source code never leaves your machine.** No file contents, no file paths, no code snippets, no secrets. There is no Hagstone server, no account, and no telemetry.

## Every request Hagstone makes

| Request | Sent | Sent to | Turn it off |
|---|---|---|---|
| Engine download | Nothing about your project. A normal file download. | GitHub releases | Install once; then `--no-install`. |
| Dependency vulnerabilities | Package names, versions and ecosystems from your manifests and lockfiles. | `api.osv.dev` | `--offline`, after `hagstone offline-db` (matched locally). |
| Supply-chain checks | Names (and versions) of public npm and PyPI packages. | `registry.npmjs.org`, `pypi.org` | `--offline` |
| Python license metadata | Python package names. | `pypi.org` | `--offline` |
| Offline vulnerability databases (`hagstone offline-db`) | Nothing about your packages. Whole-ecosystem archives. | `osv-vulnerabilities.storage.googleapis.com` | Only runs when you ask. |
| Image vulnerability database | Nothing about your project. A database download. | Anchore | `--offline` uses the cached copy. |
| Image pull (`--image`) | The image reference. | The image's registry | Scan a local `docker:` or `oci-archive:` image. |

Private packages are never looked up on public registries: npm packages under a scope that `.npmrc` sends to a private registry, and everything in a requirements file that sets its own index URL.

The GitHub Action additionally uploads the SARIF report (findings only, with secrets redacted) to **your own repository's** code scanning, and posts the check run and PR comments to **your own repository**, using the job's token.

## What the engines are told not to do

- **Trivy** doesn't download remote Terraform modules, check for updates, fetch check bundles or send telemetry.
- **OSV-Scanner** doesn't resolve transitive dependencies over the network or run your build tools.
- **Syft** doesn't run your build tools or contact Maven or Go proxies.
- No engine reads a configuration file from the scanned repository.

## Coding agents

The [MCP server](/docs/guides/coding-agents/) gives the agent finding data only: rule, title, severity, file, line and message. No code snippets and no secret values. What the agent's model provider receives is up to the agent you use.

## Verifying it

Run a scan with your network monitored, or blocked except for the hosts above. The supply-chain and Python license lookups use Node's built-in `fetch`; the engines are separate processes. The [security policy](/docs/help/security/) treats source code leaving the machine as a vulnerability.
