---
title: Reporting a vulnerability
description: How to report a security problem in Hagstone, and what counts as one.
---

Please **don't open a public issue** for a security problem in Hagstone. Report it privately: **Security → Report a vulnerability** on [github.com/kx7m2qd/hagstone](https://github.com/kx7m2qd/hagstone/security/advisories/new).

Include what you found, how to reproduce it, and the impact you expect. You'll get an acknowledgement within 3 working days and a fix or a plan within 30 days. You'll be credited in the advisory unless you'd rather stay anonymous.

Only the latest release and `main` get security fixes while Hagstone is pre-1.0.

## In scope

Hagstone reads untrusted repositories, so these are vulnerabilities:

- running code from a scanned repository, or letting it change what Hagstone executes;
- a scanned repository making an engine fetch something over the network (a remote Terraform module, for example);
- a raw secret value appearing in a finding, report, log, or anything sent off the machine;
- source code leaving the machine;
- installing or running an engine binary that doesn't match its pinned SHA-256;
- a scanned repository hiding findings from CI in a way the report doesn't show (including an engine's own ignore comments or config files);
- terminal escape or injection through finding text, or injection through GitHub Action inputs.

## Not vulnerabilities

Missed detections and false positives are bugs. Please [open a normal issue](https://github.com/kx7m2qd/hagstone/issues) for those, with a minimal example.
