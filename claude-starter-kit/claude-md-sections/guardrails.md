
## Mistake prevention (read before every change)

1. **Search before you write.** Before adding any function, class, endpoint, config key,
   or file: `grep -rn "def <name>\|<concept>"` across the repo. If something similar exists,
   extend or import it. Creating a second implementation is a mistake, not an upgrade.
2. **One source of truth per concept.** Position sizing, signal validation, ensemble
   weighting, feature building, data loading: each has exactly one function. If two exist,
   add a shared helper and make both call it; never leave a third.
3. **No new status or summary files.** Do not create `*_COMPLETE.md`, `*_SUMMARY.md`,
   `*_FINAL.md`, or similar. Progress goes into `.claude/memory/NOTES.md`; open work into
   `BACKLOG.md`. Existing status files stay but are treated as stale.
4. **Read the whole function before editing it**, and the callers (`grep -rn "<name>("`).
5. **One change per commit.** Do not mix a fix with a refactor or a feature.
6. **Never assume paths, ports, or column names.** Verify with `ls`, `grep`, or a print.
7. **After every change** the hook compiles; you still run the tests and the run command
   before claiming done. "It should work" is not done.
8. **Log lessons.** When something breaks or a wrong assumption is found, append one line
   to `.claude/memory/LESSONS.md`. It is shown at every session start. Read it before
   touching the same area again.
9. **Baseline before change.** For anything affecting signals, backtests, or models, record
   the current metrics in `.claude/memory/BASELINE.md` first, then compare after.
10. **Duplicate hook.** The post-edit hook reports any newly added function whose name is
    already defined elsewhere. Resolve it before continuing; do not rename to dodge it.

## Backtesting, strategy and training rules

- **Backtests are time-ordered and leak-free.** Train on the past, test on the future.
  Walk-forward or fixed out-of-sample split. No feature may use information from after
  the bar it belongs to (no future closes, no full-series scaling fitted on the whole set).
- **Costs are always included**: spread/commission/slippage assumptions live in one config
  and appear in every backtest report.
- **A strategy is a written hypothesis** with entry rules, exit rules, risk per trade,
  session/regime filters, and the metric that decides success. Use `/strategy` to write it
  before coding; the file lives in `strategies/<name>.md`.
- **Report the same metrics every time**: trades, win rate, profit factor, expectancy,
  max drawdown, Sharpe (or Sortino), CAGR, average R, exposure, and the date range.
  Write them to `.claude/memory/BASELINE.md` with the git commit hash.
- **Training never overwrites the live model.** New models are saved versioned
  (`models/<name>_<YYYYMMDD-HHMMSS>/`), evaluated on the held-out period, compared with
  the current baseline, and promoted only if better on the agreed metric and not worse on
  drawdown. Promotion is a separate, logged step.
- **Random seeds are fixed** and recorded; data ranges and feature lists are recorded with
  every model and every backtest so results are reproducible.
- **One ensemble formula.** The live path and the evaluation path must call the same
  function with the same weights. If they differ, fix that before any new training.
- **Overfitting checks**: parameter sweeps report out-of-sample results only; a strategy
  with fewer than ~100 trades in the test period is "insufficient evidence", not a result.
