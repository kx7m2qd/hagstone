---
title: Introduction
description: What Hagstone is, what it checks, and what it never sends anywhere.
---

Hagstone is an application security scanner that runs where your code already is: your laptop, your CI runner, your own network. One command checks your code, dependencies, secrets, supply chain, infrastructure-as-code, licenses and container images, and reports everything as one list of findings in one format.

```sh
npx hagstone scan .
```

## What it checks

| Check | Engine | What it reports |
|---|---|---|
| **Code** | [Opengrep](https://github.com/opengrep/opengrep) with Hagstone's own rules | Injection, XSS, unsafe deserialization, path traversal, SSRF, missing auth and more, in JavaScript/TypeScript, Python and Java. Java follows data across files. |
| **Dependencies** | [OSV-Scanner](https://github.com/google/osv-scanner) | Packages with known vulnerabilities, one finding per package version, with the version that fixes them. |
| **Secrets** | [Gitleaks](https://github.com/gitleaks/gitleaks) | API keys, tokens and credentials committed to the code. Values are redacted everywhere. |
| **Supply chain** | `pkgrisk` (built into Hagstone) | Packages that don't exist, typosquats, brand-new packages and versions, install scripts, known-malicious packages. npm and PyPI. |
| **Infrastructure as code** | [Trivy](https://github.com/aquasecurity/trivy) | Real exposure in Terraform, Kubernetes, Dockerfile, Helm, CloudFormation, ARM and Ansible: a public bucket, SSH open to the internet, a privileged container. |
| **Licenses** | [Syft](https://github.com/anchore/syft) | Dependencies under AGPL/SSPL, GPL, or non-commercial licenses, adjustable with a policy file. |
| **Container images** | Syft + [Grype](https://github.com/anchore/grype) | Vulnerable OS and language packages in an image, one finding per package to upgrade. |

Every engine's output is turned into the same finding format, so the report, the [baseline](/docs/guides/existing-codebase/), the CI gate and the [JSON and SARIF output](/docs/reference/output-formats/) work the same way for all of them.

## What stays on your machine

Your source code, file contents and file paths never leave the machine. To look up vulnerabilities and package risk, Hagstone sends **package names and versions** to osv.dev, the npm registry and PyPI. [What leaves your machine](/docs/concepts/what-leaves-your-machine/) lists every network request exactly.

## Built to be quiet

A scanner that reports everything gets ignored. By default Hagstone:

- **lowers** a vulnerable dependency by one severity level when nothing in your project imports it, or only tests and dev tooling do;
- **hides** code findings in test and example code (secrets and malicious packages are always shown);
- **hides** infrastructure hardening advice that exposes nothing on its own, and tells you how many it set aside;
- reports **one finding per package to upgrade**, not one per advisory;
- lets you [baseline](/docs/guides/existing-codebase/) today's findings so you only see new ones.

[Severity and noise](/docs/concepts/severity-and-noise/) explains each of these and how to turn them off.

## Where it runs

- **Your terminal:** `hagstone scan`. See [Your first scan](/docs/getting-started/first-scan/).
- **Pull requests:** the [GitHub Action](/docs/guides/github-action/) adds a check, code scanning alerts and inline comments. [Other CI systems](/docs/getting-started/ci/) work with the CLI.
- **Before every commit:** the [pre-commit hook](/docs/guides/pre-commit-hook/) blocks secrets and high-severity issues on the lines you add.
- **Inside coding agents:** the [MCP server](/docs/guides/coding-agents/) lets Claude Code, Cursor and others scan their own changes and check a package before installing it.

## License

Hagstone is open source under the [Apache-2.0 license](https://github.com/kx7m2qd/hagstone/blob/main/LICENSE).
