# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for a security problem in Hagstone.

Report it privately through GitHub: **Security → Report a vulnerability** on
<https://github.com/kx7m2qd/hagstone/security/advisories/new>.

Include what you found, how to reproduce it, and the impact you expect. You'll get an
acknowledgement within 3 working days and a fix or a plan within 30 days. We'll credit you in the
advisory unless you'd rather stay anonymous.

## Supported versions

Only the latest release and `main` get security fixes while Hagstone is pre-1.0.

## What's in scope

Hagstone reads untrusted repositories, so these are the things we treat as vulnerabilities:

- Running code from a scanned repo, or letting it change what Hagstone executes
- A scanned repo making an engine fetch something over the network (e.g. a remote Terraform module)
- A raw secret value appearing in a finding, report, log, or anything sent off the machine
- Source code leaving the machine (only package names/versions go to registries and osv.dev),
  or anything about the project being sent during an `--offline` scan
- Installing or running an engine binary that doesn't match its pinned SHA-256 (the pins themselves
  are checked against upstream Sigstore signatures / SLSA provenance in CI on every change)
- A scanned repo hiding findings from CI in a way the report doesn't surface (including an engine's
  own inline-ignore comments or config files, such as `trivy:ignore` or `trivy.yaml`)
- Terminal escape or injection through finding text, or injection through GitHub Action inputs

Missed detections and false positives are bugs, not vulnerabilities. Open a normal issue for those.
