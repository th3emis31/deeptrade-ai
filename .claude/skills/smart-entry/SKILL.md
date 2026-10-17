---
name: smart-entry
description: Design, review, or improve the automated smart entry system (entry/SL/TP, risk sizing, regime and session gating, confidence). Use when the user mentions entries, signals, execution, risk, SL/TP, or "smart entry".
---

# Smart entry system

Purpose: make every automated entry in DeepTrade AI safer and smarter. The relevant code
is in `src/src/App.jsx`: `calcPositionSize`, `calcProfit`, `detectRegime`,
`detectCorrelation`, `mlConfidenceAdjust`, `rateMarketDay`, the signal generator that
calls `callClaude`, and `SignalsPage` / `AIAdvisorPage`.

## Entry quality checklist (an entry must pass all)
1. **Structure**: `dir`, `entry`, `sl`, `tp1` present and numeric; `tp2`/`tp3` optional.
2. **Direction sanity**: BUY → sl < entry < tp1; SELL → tp1 < entry < sl.
3. **Risk:reward**: (tp1 − entry) / (entry − sl) ≥ 1.5 (absolute values).
4. **Sizing**: lots from `calcPositionSize(pair, balance, riskPercent, slPips)`; risk per
   trade ≤ account `riskPercent`; never hard-code a lot size.
5. **Regime gate**: `detectRegime` result compatible with direction (no counter-trend
   entries in a strong trend unless grade A with confidence ≥ 80).
6. **Session gate**: the asset's best session (`SESSIONS`, ML session stats) or explicit
   user override.
7. **Market day gate**: `rateMarketDay` ≠ AVOID for automated execution.
8. **Confidence**: final `conf` = `mlConfidenceAdjust(signal, mlState)`; automated
   execution only when conf ≥ 70 and grade A/B.
9. **Correlation**: no two simultaneous entries in assets `detectCorrelation` flags as
   highly correlated in the same direction beyond the risk budget.
10. **Idempotence**: the same signal is never executed twice (check `status` and an id).

## How to implement improvements
- Put the rules in a pure function, e.g. `validateEntry(signal, ctx) → {ok, reasons[]}`
  and `smartEntryPlan(signal, account, mlState, candles) → enriched signal`, placed with
  the other helpers near the top of App.jsx.
- Surface the result in the UI as reasons (why blocked / why approved), using `T` colours.
- Log every automated decision into the account alerts (`ADD_ALERT`) so the user can audit.
- Keep manual signal entry working exactly as before; the smart layer is additive.

## Review mode
When asked to review, output a table: rule → pass/fail → file:line → suggested fix.
Then, unless told otherwise, apply the fixes with `/safe-upgrade`.
