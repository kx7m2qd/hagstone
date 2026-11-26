---
title: Container images
description: Scan a container image for vulnerable OS and language packages, one finding per package to upgrade.
---

```sh
hagstone scan --image alpine:3.20
```

[Syft](https://github.com/anchore/syft) catalogues every package in the image (OS packages and language packages) and [Grype](https://github.com/anchore/grype) matches them against its vulnerability database. The image is catalogued once, so the SBOM and the findings always agree.

## Image references

| Reference | Where the image comes from |
|---|---|
| `alpine:3.20` | Whatever Syft finds first: the local Docker daemon, then the registry. |
| `registry:ghcr.io/org/app:1.2` | Pulled from the registry, no Docker needed. |
| `docker:app:dev` | The local Docker daemon (for example, an image you just built). |
| `oci-archive:app.tar` | An OCI archive file on disk. |

## One finding per package to upgrade

Packages built from the same source are grouped: `libcrypto3` and `libssl3` are one **openssl** finding, because you upgrade them together. On `alpine:3.18.0`, 63 raw vulnerability matches become 4 findings. Each finding names the fixed version, and says when an advisory is marked won't-fix by the distribution. Advisories a distribution rates as negligible are counted, not reported.

## The vulnerability database

The first image scan downloads Grype's vulnerability database from Anchore (several GB on disk, verified by Grype, cached in `~/.cache/hagstone/grype-db` or `$HAGSTONE_GRYPE_DB_DIR`). Later scans update it when it's out of date. With `--offline`, the cached copy is used as is, and the report says when it was built.

The image's package list never leaves your machine. Pulling the image talks to its registry, as `docker pull` would.

## Point findings at your Dockerfile

Findings normally point at the package database inside the image (`/lib/apk/db/installed`). For pull request checks and code scanning, which need a file in the repository, point them at the Dockerfile instead:

```sh
hagstone scan --image docker:app:dev --dockerfile Dockerfile
```

Findings then point at the Dockerfile's final `FROM` line (the stage that becomes the image), and the message says where in the image the package was found.

## Options

`--image` works with `--format`, `--output`, `--fail-on`, `--baseline` and `--offline`. An image has no repository root, so its baseline is only used when you pass `--baseline <file>`. Baseline decisions don't include the image name, so they carry across tags.

## In GitHub Actions

See [Scan a container image too](/docs/guides/github-action/#scan-a-container-image-too). The Action uses `Dockerfile` automatically when it exists, and uploads image results under their own code scanning category.
