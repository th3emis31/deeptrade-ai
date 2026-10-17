# Improvement backlog (additive only, one per /improve-loop iteration)

## First session
- [ ] Run `/brain fill` so CLAUDE.md describes the real entry, sizing, order, data and model code
- [ ] Add a dry-run flag on the order/execution path if none exists
- [ ] Add `validate_entry()` with direction sanity and R:R ≥ 1.5
- [ ] Add an idempotence guard so a signal is never executed twice
- [ ] Add timeouts and one retry around data-feed and broker calls
- [ ] Add unit tests for position sizing and P&L
