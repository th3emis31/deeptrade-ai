# Moving a TradingView strategy into the trading system

Written for Volatility Trend Breakout (Better Exits), but the gates apply to any
strategy that arrives as a Pine script.

## Where it belongs

The breakout is currently the strongest candidate measured: 178 trades, 74.16%
wins, profit factor 1.938, 5.50% max drawdown over 2023-2026. That is better than
the 21/50 pullback on every axis, so in the router it takes over as the **trend
engine**, replacing the pullback rather than sitting beside it. Family C stays as
the range engine. Nothing is deleted: the pullback stays in the file behind its
own toggle so the three-way comparison can be rerun.

## Step 0 — the blocker

The Pine source has to be read before anything is ported. A screenshot of the
Strategy Tester proves nothing about repainting, costs or sizing, and those are
exactly the three ways a good-looking row turns out to be an artefact.

Audit checklist for the source:

- Every `request.security` uses `lookahead=barmerge.lookahead_off` and reads a
  closed bar, or the result is inflated and the row is void.
- `commission_type`, `commission_value` and `slippage` are set in `strategy()`.
- Sizing: `default_qty_type` and whether the tester ran fixed or percent of equity.
- Exits: if the stop and the target can both sit inside one bar, the result
  depends on TradingView's intrabar assumption. Note how often that happens.
- Any six-decimal threshold is a fitted parameter; list them all.

## Step 1 — port to one function

The rules go into `src/signal_engine.py` as a pure function that takes a candle
frame and returns the signal object. It must be reachable through the single
`predict_signal` entry point, because signal parity is the only thing that makes
the backtest and the executor comparable. No separate copy of the logic anywhere.

The function returns, or returns nothing: direction, entry, stop, at least TP1,
the ATR used, the regime and session it passed, and the reason it fired. A signal
without a reason string cannot be reviewed later.

## Step 2 — reproduce the TradingView row

Before trusting the port, run the Python version over the same symbol and window
and compare against 178 trades / PF 1.938. A port that produces a different trade
count is a different strategy. Investigate the difference before continuing;
common causes are bar timestamps, session filters and the first-bar warm-up.

## Step 3 — the Strategy Lab gates

All of these, no exceptions and no averaging them out:

| Gate | Threshold |
|---|---|
| Out-of-sample trades | 100 or more |
| Profit factor after broker costs | above 1.3 |
| Inverse-direction baseline | must be worse than the strategy |
| Deflated Sharpe ratio | 0.95 or above |
| Walk-forward | leak-free, parameters fixed before each fold |
| Regime check | one run outside 2023-2026, e.g. 2013-2018 gold |

The regime check matters most here. Everything measured so far lives inside a
historic gold bull market, and a long-biased breakout is exactly the strategy
that flatters itself in one.

## Step 4 — demo forward test

Vantage MT5 demo through the existing bridge, with the guards already built:
its own magic number, the tier-1 event windows, the 3xATR volatility circuit
breaker, percent-of-equity sizing, and the daily loss kill switch.

Run it for at least 20 trades. Then compare the demo row against the backtest
row on the same four numbers: trade count, win rate, profit factor, average loss.
A demo win rate more than about ten points below the backtest means the backtest
was optimistic, most likely through intrabar fills, and the strategy goes back to
step 3 rather than forward.

## Step 5 — what is not in this document

Whether to trade it with real money. That is not a technical gate and it is not
mine to set. The system's job is to tell you honestly what the strategy did on
data it had never seen, and the demo row is what that looks like.

## Record keeping

Every run appends a row to `.claude/memory/BASELINE.md`. Rows are never edited,
including the bad ones. The bad rows are what stop a strategy being re-tried
under a new name six months later.
