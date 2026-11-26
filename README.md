# Hagstone

Local-first application security scanner. One command runs SAST, dependency vulnerability, secret,
supply-chain, infrastructure-as-code and license checks, and reports everything as a single list of findings.

Your source code never leaves your machine or CI runner. To look up vulnerabilities and package risk,
Hagstone sends package names and versions to osv.dev, npm and PyPI, and nothing else. `--offline` sends
nothing: vulnerabilities are matched against databases you download once with `hagstone offline-db`.

- **Code:** taint-aware [Opengrep](https://github.com/opengrep/opengrep) rules for JavaScript/TypeScript,
  Python and Java (servlets, Spring MVC, JAX-RS; JDBC, JdbcTemplate, JPA, Hibernate). Every rule ships
  with tests and maps to a CWE and an OWASP category. Java follows untrusted data through helper
  methods and across files (a controller passing input to a repository in another class).
- **Dependencies:** known vulnerabilities via [OSV-Scanner](https://github.com/google/osv-scanner),
  with a reachability check that lowers the severity of vulnerable packages nothing imports.
- **Secrets:** [Gitleaks](https://github.com/gitleaks/gitleaks). Secret values are redacted from every
  report.
- **Supply chain:** typosquats, install scripts, known-malicious packages.
- **Infrastructure as code:** Terraform, Kubernetes, Dockerfile, Helm, CloudFormation, ARM and Ansible
  via [Trivy](https://github.com/aquasecurity/trivy)'s built-in checks. Only things that expose
  something are reported (a public bucket, SSH open to the internet, a privileged container); the
  best-practice hardening checks are counted, and `--include-hardening` shows them. Inline
  `trivy:ignore` comments in the scanned repo are not honoured, and remote Terraform modules are
  never downloaded.
- **Licenses and SBOM:** [Syft](https://github.com/anchore/syft) catalogs the shipped dependencies.
  AGPL/SSPL, GPL and non-commercial licenses are reported (`A OR B` is fine if either option is);
  `.hagstone/licenses.json` (`{"allow": [...], "deny": [...]}`) adjusts that. `hagstone sbom` writes a
  CycloneDX or SPDX SBOM.
- **Container images:** `hagstone scan --image <ref>`. Syft catalogs the image and
  [Grype](https://github.com/anchore/grype) matches it: one finding per source package to upgrade
  (`openssl (libcrypto3, libssl3)`), not one per CVE per binary. The first image scan downloads
  Grype's vulnerability database (several GB on disk, cached); `--offline` uses the cached copy.

Engine binaries are pinned by version and SHA-256, and Hagstone checks them on every run. CI checks
each pin against the upstream release's Sigstore signature or SLSA provenance (Gitleaks publishes
neither).

## Install

Requires Node.js 22 or newer.

```sh
npx hagstone scan .
# or
npm install -g hagstone
hagstone scan .
```

The first run downloads the pinned engines into `~/.cache/hagstone`. Prebuilt engines exist for
Linux x64 and macOS arm64.

## Usage

```sh
hagstone scan [path]                 # text report; exits 1 on findings at or above --fail-on (default: high)
hagstone scan --format sarif --output hagstone.sarif
hagstone scan --image ghcr.io/org/app:1.2   # container image (registry, docker:, oci-archive:)
hagstone sbom --output sbom.cdx.json # CycloneDX SBOM (--format spdx for SPDX); --image for an image
hagstone hook install                # pre-commit hook: scans staged changes for code issues and secrets
hagstone mcp                         # MCP server for coding agents (scan, explain, check_package)
hagstone --help                      # every flag
```

Add it to Claude Code as an MCP server:

```sh
claude mcp add hagstone -- npx -y hagstone mcp
```

### Adopting on an existing project

```sh
hagstone baseline create             # snapshot today's findings into .hagstone/baseline.json; commit it
hagstone scan                        # from now on: only new findings, or old ones that got worse
hagstone suppress <id|path:line> --as false-positive --reason "escaped by the template engine"
hagstone suppress <id|path:line> --as accepted-risk --reason "internal tool" [--expires 2027-03-01]
hagstone baseline prune              # drop entries for fixed findings; re-attach moved code
```

A baselined finding comes back if it gets worse: a new advisory for the same package version, a
higher severity, a package that becomes reachable, or an `accepted-risk` past its expiry (90 days by
default). Secrets can only be marked `false-positive` (rotate real ones), and known-malicious packages
can't be suppressed. There are no inline "ignore" comments: decisions live in one reviewed file.
`--no-baseline` shows everything.

Skip paths with a `.hagstoneignore` file at the scan root: one entry per line, either a path prefix
(`test/fixtures/`) or a bare name that matches at any depth (`fixtures`). `node_modules/`, `dist/`,
`vendor/` and similar directories are always skipped.

## GitHub Action

```yaml
- uses: actions/checkout@v7
- uses: kx7m2qd/hagstone@v0
  with:
    fail-on: high
```

The Action gives you a pass/fail check, code scanning alerts and inline PR comments on the lines a PR
adds. [docs/github-action.md](docs/github-action.md) has the full workflow, inputs and outputs.

## Exit codes

`0` clean · `1` findings at or above `--fail-on` · `2` usage or engine error

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## License

[Apache-2.0](LICENSE)
