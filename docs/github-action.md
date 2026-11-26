# Hagstone GitHub Action

Runs Hagstone on every push and pull request, inside your own GitHub runner. Source code never leaves
the runner; only the SARIF report is uploaded, to your repo's own code scanning.

```yaml
# .github/workflows/hagstone.yml
name: Hagstone
on:
  push:
    branches: [main]
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write   # for the code scanning upload
    steps:
      - uses: actions/checkout@v7
      - uses: kx7m2qd/hagstone@v0
        with:
          fail-on: high
```

Results appear in three places: a red/green check on the PR, alerts in **Security → Code
scanning** (annotated on changed lines in the PR), and a findings table in the run's job summary.

## Inputs

| Input | Default | What it does |
|---|---|---|
| `path` | `.` | Directory to scan |
| `image` | | Scan this container image instead of `path` (`docker:my-app:<sha>` after a build step, `ghcr.io/org/app:1.2`, `oci-archive:app.tar`) |
| `dockerfile` | `<path>/Dockerfile` if present | With `image`: findings point at this Dockerfile's final `FROM` line |
| `sarif-category` | `hagstone`, or `hagstone-image:<name>` with `image` | Code scanning category |
| `fail-on` | `high` | Fail if any finding is at least this severe (`critical`…`info`, or `none`) |
| `trust-reachability` | `false` | Let `fail-on` use the lowered severity of dependencies nothing uses, or only tests and dev tooling use |
| `reachable-only` | `false` | Leave unreachable dependency findings out entirely |
| `include-tests` | `false` | Also report code and dependency findings in test and example code (secrets and malicious packages are always reported) |
| `offline` | `false` | Send no package names anywhere: download OSV's databases for the project's ecosystems at the start of the job, match offline, and skip npm/PyPI lookups |
| `engines` | all | Comma-separated subset: `opengrep,osv-scanner,gitleaks,pkgrisk,trivy,syft` |
| `upload-sarif` | `true` | Upload to code scanning. Private repos need GitHub Advanced Security. |
| `sarif-file` | `hagstone.sarif` | Where the report is written (also an output, for later steps) |

Outputs: `exit-code` (0 clean, 1 findings at/above `fail-on`, 2 scan error) and `sarif-file`.

## Notes
- Linux x64 runners only for now (the pinned engine binaries are linux-x64 and darwin-arm64).
- Engine binaries are cached between runs and re-checked against their pinned SHA-256 every run.
- Paths in `.hagstoneignore` at the scan root are skipped. On pull requests the **base branch's**
  `.hagstoneignore` is used, so a PR can't exclude the code it adds; a PR that edits it gets a warning,
  and the change applies after merge.
- `.hagstone/baseline.json` (from `hagstone baseline create` / `hagstone suppress`) works the same way:
  on pull requests the **base branch's** copy is used, so a PR can't hide the findings it adds. A PR
  that changes it gets a warning, and the change applies after merge; to adopt Hagstone on a repo with
  existing findings, merge the baseline in its own PR first. Stale entries (fixed findings) are a
  warning annotation, never a failure. Baselined findings are left out of the SARIF upload, so their
  code scanning alerts close; the job summary shows the counts.
- `@v0` follows the latest 0.x release. For a fixed, auditable version, pin a full commit SHA
  (`kx7m2qd/hagstone@<sha> # v0.2.0`). Avoid `@main`: it changes with every push.
- `.hagstone/licenses.json` (license allow / deny lists) works the same way: the base branch's copy
  is used on pull requests, and a PR that changes it gets a warning.
- IaC findings come from Trivy's built-in checks; inline `trivy:ignore` comments in the repo are not
  honoured (use `hagstone suppress`), and remote Terraform modules are never downloaded.
- Container images: run the Action a second time with `image` after the build step:

  ```yaml
  - run: docker build -t my-app:${{ github.sha }} .
  - uses: kx7m2qd/hagstone@v0
    with:
      image: docker:my-app:${{ github.sha }}
  ```

  - Findings point at the Dockerfile's final `FROM` line (the base image is usually the fix), so they
    show up as annotations, PR comments when that line changes, and code scanning alerts on a real
    file. The path inside the image is in the message. Without a Dockerfile, they are listed in the
    check run summary instead: annotations and review comments can only point at repository files.
  - Results upload under `hagstone-image:<image name>` (tag and digest dropped), so they never replace
    the repository scan's alerts, and each new tag updates the same analysis.
  - `.hagstoneignore`, the baseline and the license policy describe the repository, so image mode
    doesn't read them; `engines` and `include-tests` don't apply.
  - Grype's vulnerability database (several GB) is downloaded on each run; it is kept out of the
    engine cache on purpose.
- Any finding whose path isn't a file in the checkout (not only image packages) is listed in the check
  run summary rather than sent as an annotation or comment.
