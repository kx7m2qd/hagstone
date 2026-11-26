---
title: Infrastructure as code
description: Find real exposure in Terraform, Kubernetes, Dockerfiles, Helm, CloudFormation, ARM and Ansible.
---

Hagstone runs [Trivy](https://github.com/aquasecurity/trivy)'s configuration checks over your infrastructure files as part of every `hagstone scan`. Nothing extra to set up.

**Covered:** Terraform, Kubernetes manifests, Dockerfiles, Helm charts, CloudFormation, Azure ARM templates and Ansible.

## Exposure first, hardening hidden

Infrastructure scanners report every best-practice gap: three small files can produce thirty findings, most of them "consider enabling X". Hagstone reports the checks where something is actually **exposed**, such as:

- a storage bucket readable by anyone;
- SSH or a database port open to `0.0.0.0/0`;
- a container running privileged or as root with host access;
- encryption turned off on data at rest.

**Hardening** checks (every Trivy `LOW` check, plus a reviewed list of checks that don't expose anything on their own, such as "use a customer-managed KMS key") are hidden and counted in one warning line. Show them with:

```sh
hagstone scan . --include-hardening
```

Hidden hardening findings are never baselined or gated.

## Reading a finding

```text
HIGH     S3 Buckets not publicly accessible through ACL. (aws_s3_bucket_acl.assets)
         infra/storage.tf:7  trivy/AWS-0092
         Bucket has a public ACL: "public-read". Buckets should not have ACLs that allow public access. Fix: Don't use canned ACLs or switch to private acl. https://avd.aquasec.com/misconfig/aws-0092

HIGH     Security groups should not allow unrestricted ingress to SSH or RDP from any IP address. (aws_security_group.ssh)
         infra/storage.tf:16  trivy/AWS-0107
         Security group rule allows unrestricted ingress from any IP address. …

2 findings: 2 high
trivy 2 in 612ms
warning: trivy: 10 IaC hardening checks hidden (best practice, not an exposure); --include-hardening shows them
```

That's real output for a two-resource Terraform file: two exposures reported, ten hardening suggestions set aside.

The rule id is Trivy's check id (`AWS-0092`, `KSV-0017`, `DS-0002`). The message says what's wrong, why it matters, and how to fix it, with a link to the check. IaC findings show **no code snippet**: these files often hold credentials, and any real secret is reported separately by the secret scanner, redacted.

Findings in test and example folders (Terraform `examples/` modules, for instance) are hidden by default, like code findings.

## Safe on untrusted repositories

A repository can try to change what an infrastructure scanner does. Hagstone scans a sanitized copy of your IaC files:

- inline `trivy:ignore` / `tfsec:ignore` comments are removed, so a pull request can't silence a check in the file it adds (record decisions with [`hagstone suppress`](/docs/guides/suppressing-findings/) instead);
- a repository's `trivy.yaml` and `.trivyignore` are not read;
- remote Terraform modules (registry, `git::`, `http`, `s3::`) are **not downloaded**; only modules inside the repository are scanned;
- Trivy's checks bundle is the one built into the pinned binary; nothing is fetched.

So IaC scanning makes no network requests at all.
