---
title: Suppressing findings
description: Record a decision about one finding, with a reason, in a reviewed file instead of inline comments.
---

Sometimes a finding is wrong, or it's real and you've decided to live with it for now. Record that decision with `hagstone suppress`. It goes into `.hagstone/baseline.json` with your reason, so it's reviewed in a pull request like any other change.

## Two kinds of decision

| Kind | Use it when | Expires |
|---|---|---|
| `false-positive` | The code is safe; the rule is wrong here. | Never. |
| `accepted-risk` | The issue is real, but you've decided to accept it for now (an internal tool, a fix that's scheduled). | After 90 days by default, or the date you set. Then it fails the gate again. |

```sh
hagstone suppress app.py:20 --as false-positive --reason "term is an enum value validated on line 12"

hagstone suppress app.py:45 --as accepted-risk --reason "admin-only tool, fix in Q1" --expires 2027-03-01
```

Commit `.hagstone/baseline.json` afterwards.

## Pointing at a finding

Use either:

- **`path:line`**, as shown in the report (`app.py:20`). If several findings are on that line, Hagstone lists their ids and asks you to pick one.
- **The finding id**, from `--format json` output (the `id` field) or the coding-agent `scan` tool. A unique prefix of the id is enough.

`suppress` runs a full scan to find the finding, so run it from the repository root, or pass `--path <root>`.

## Rules that protect you

- **Secrets** can only be marked `false-positive`. A real leaked secret must be rotated, not accepted.
- **Known-malicious packages** can't be suppressed at all.
- A `--reason` is required, so the next person knows why.
- There are **no inline ignore comments**. Every decision lives in one file, with its reason and date, where `git blame` shows who made it. Engine-specific inline ignores in the scanned code (such as `trivy:ignore`) are not honoured.

## Changing your mind

Run `hagstone suppress` again on the same finding to replace the decision, or delete the entry from `.hagstone/baseline.json`. To see suppressed findings in a report, scan with `--no-baseline`.
