---
title: FAQ
description: Short answers to common questions about Hagstone.
---

### Does my source code leave my machine?

No. Only package names and versions are sent, to look up vulnerabilities and package risk. [Every request is listed here](/docs/concepts/what-leaves-your-machine/).

### Is it free?

The scanner is open source under Apache-2.0, and free to use, including commercially.

### Which languages are supported?

Code rules: **JavaScript/TypeScript, Python and Java**. Dependency vulnerabilities: every ecosystem OSV-Scanner supports (npm, PyPI, Maven, Go, Cargo, RubyGems, Composer, NuGet and more). Reachability and supply-chain checks: npm and PyPI.

### How is it different from running the engines myself?

You could run Opengrep, OSV-Scanner, Gitleaks, Trivy and Syft yourself. Hagstone adds: its own tested taint rules (the engines don't ship with these), one finding format and report, reachability, baselines with resurfacing, test-code and hardening filtering, protections against a scanned repository changing the scanners' behaviour, verified pinned binaries, and the CI, hook and agent integrations.

### Can I write my own rules?

Hagstone's rules are Opengrep YAML in [`rules/`](https://github.com/kx7m2qd/hagstone/tree/main/rules), each with a test file. Custom rule directories aren't a supported option yet. If a rule would be useful to others, contributions are welcome.

### Does it replace a penetration test?

No. A scanner finds known patterns of vulnerability in code and configuration. It doesn't find business-logic flaws, and it can't prove an application is secure.

### Does it work on monorepos?

Yes. Scan the root, or each service separately with `hagstone scan services/api`. Reachability looks at each lockfile's own project folder.

### What about Windows?

Use WSL 2. See [Installation](/docs/getting-started/installation/#requirements).

### Does it fix findings?

Not yet. Every finding's message says how to fix it, and with the [MCP server](/docs/guides/coding-agents/) your coding agent can scan and fix its own changes.

### Where do I report a vulnerability in Hagstone?

Privately, through GitHub. See [Security](/docs/help/security/).
