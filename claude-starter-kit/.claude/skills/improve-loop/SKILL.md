---
name: improve-loop
family: software
description: Continuous improvement loop. Each iteration finds one safe, additive upgrade to the smart entry system or code quality, applies it with /safe-upgrade, verifies, commits. Use with /loop for recurring runs (e.g. "/loop 30m /improve-loop").
---

# Improve loop (one iteration)

Each run makes exactly one small, safe, verified improvement and stops. Repeat with the
built-in loop: `/loop 30m /improve-loop` (or `/loop /improve-loop` self-paced).

1. **Pick** the next open item from `.claude/memory/BACKLOG.md`, in this priority:
   1. Smart entry safety (validation, R:R, gates, sizing, idempotence, dry-run).
   2. Error handling around external calls (data feeds, broker/exchange, model loading):
      timeouts, retries, clear failure messages, no crash on missing credentials.
   3. Correctness of calculations (P&L, sizing, indicators) with unit tests.
   4. Persistence and state safety (atomic writes, versioned formats).
   5. Logging and observability of automated decisions.
   6. Code quality that removes nothing.
   If the backlog is empty, scan the code for one item in category 1 or 2 and add it first.
2. **Apply** via `/safe-upgrade`.
3. **Verify** via `/verify`. On FAIL fix or restore the backup; never leave the tree red.
4. **Commit** on the current `claude/*` branch.
5. **Record**: one line in NOTES.md; tick the item in BACKLOG.md; add new ideas found.
6. **Stop** and report: what changed, check result, commit hash, next candidate.

Hard rules: one improvement per iteration; no deletions; no secrets; no push to `main`;
if nothing safe is left, say so and stop.

Never, in any iteration: run the live or broker code path, start a server that can place
orders, or place, modify or close an order. An unattended iteration may read, measure, edit,
test and commit — nothing else. A rule written in another file is not a constraint on this
loop; this paragraph is.

Stop conditions, so the loop cannot grind: three consecutive iterations with no safe
improvement found, or three consecutive verify failures, ends the loop with a report.
Every iteration writes one line to NOTES.md naming what it changed, so a scheduled run can
be attributed afterwards.

## Acceptance

This skill may not report success on its own say-so.
At least one check below is adjudicated by something other than the model.

```acceptance
run: python scripts/doctor.py --quiet
appended: .claude/memory/NOTES.md
ask: did this iteration avoid the live path, the broker and any server that can place an order?
```
