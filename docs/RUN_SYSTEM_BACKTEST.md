# Running the system's own backtest

For the local Claude Code session inside `C:\Users\th_em\ml_trading_system`.
This cloud session cannot reach that machine.

## What this measures

The system's backtest runs **what is already in the system**: the rule strategies and
the RF/LSTM signal path. It does not know about the TradingView breakout until that
one is ported, so this run tells you where the system stands today, which is the
number the breakout has to beat.

## Prompt to paste

```text
Run the system's existing backtest and report it honestly.

1. Find the existing entrypoint first: grep -rn "backtest|walk_forward|out_of_sample"
   in src/ and scripts/. Use it. Do not write a second engine and do not fork it.
2. Run it on XAUUSD, the longest history the system has, with broker costs on
   (spread, commission, slippage from the single cost config).
3. Report out-of-sample results only, walk-forward if the engine supports it.
4. Also run the inverse-direction baseline on the same window, so I can see whether
   the edge is the rules or the market direction.
5. Metrics: trades, win rate, profit factor, expectancy in R, max drawdown,
   Sharpe, CAGR, longest losing streak. Under 100 out-of-sample trades, label the
   row "insufficient evidence" rather than drawing a conclusion.
6. Append a dated row per run to .claude/memory/BASELINE.md with the commit hash.
   Never edit an old row, including the bad ones.
7. State plainly whether it is better, worse, or not significant against the
   previous baseline row.

Hard constraints:
- Do not write to models/ and do not retrain or promote anything. Use the test
  isolation fixture.
- Do not tune any parameter on the test period. Sweeps run on train, results are
  reported on test.
- If the result is negative, say so in the first line. A bad row recorded is worth
  more than a good row invented.
```

## After it finishes

Compare three numbers against the TradingView rows already in `BASELINE.md`:
trade count, profit factor after costs, and maximum drawdown. If the system's own
strategies come out worse than the breakout on all three, that is the argument for
porting the breakout, and `strategies/PORTING_TO_SYSTEM.md` is the path.

If the inverse baseline is as good as the strategy, the rules are not the edge and
nothing should be promoted, whatever the profit factor says.
