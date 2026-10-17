# Improvement backlog (additive only, one per /improve-loop iteration)

## Smart entry system
- [ ] Add `validateEntry(signal, ctx)` pure helper enforcing direction sanity and R:R ≥ 1.5
- [ ] Add `smartEntryPlan()` that attaches lot size from calcPositionSize and gate reasons
- [ ] Block automated execution when rateMarketDay() is AVOID, with an audit alert
- [ ] Session gate: prefer the asset's best session from ML session stats
- [ ] Correlation guard using detectCorrelation for same-direction stacked entries
- [ ] Idempotent execution: signal id + status check before any auto action

## Reliability
- [ ] Timeout + single retry in callClaude; friendly notification when the key is missing
- [ ] Guard sendTelegram failures with a user-visible notification
- [ ] Persist signals / account / ML state to localStorage with version key

## Quality
- [ ] Add a minimal test runner (vitest) for the pure helpers (calcProfit, calcRSI, calcEMA)
- [ ] Add ESLint (react plugin) with a non-blocking `npm run lint`
