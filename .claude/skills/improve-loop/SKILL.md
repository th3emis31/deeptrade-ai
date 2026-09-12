---
name: improve-loop
description: Continuous improvement loop for DeepTrade AI. Each iteration finds one safe, additive upgrade to the smart entry system or app quality, applies it with /safe-upgrade, verifies, commits. Use with /loop for recurring runs (e.g. "/loop 30m /improve-loop").
---

# Improve loop (one iteration)

Each run makes exactly one small, safe, verified improvement and stops. Combine with the
built-in `/loop` skill to repeat: `/loop 30m /improve-loop` or `/loop /improve-loop`
(self-paced).

## Iteration
1. **Pick** the next item, in this priority order, skipping anything already done (check
   `.claude/memory/NOTES.md` and `.claude/memory/BACKLOG.md`):
   1. Smart entry safety (validation, R:R, regime/session/market-day gates, sizing).
   2. Error handling around `callClaude` / `sendTelegram` (timeouts, retries, user-visible
      failure messages, no crashes when the key is missing).
   3. Correctness of calculations (`calcProfit`, `calcPositionSize`, `calcRSI`, `calcEMA`).
   4. Persistence (save/restore signals, account, ML state from localStorage) — additive.
   5. UX polish that does not remove anything.
2. **Apply** it via the `/safe-upgrade` protocol (backup → minimal edit → build).
3. **Verify** via `/verify`. If FAIL, fix or revert to the backup; never leave the tree red.
4. **Commit** on the current `claude/*` branch with a clear message.
5. **Record**: append one line to `.claude/memory/NOTES.md` and tick the item in
   `.claude/memory/BACKLOG.md` (add new ideas discovered along the way to the backlog).
6. **Stop** the iteration. Report: what changed, build result, commit hash, next candidate.

## Hard rules
- One improvement per iteration. No deletions. No secrets. No push to `main`.
- If nothing safe is left in the backlog, say so and stop instead of inventing churn.
