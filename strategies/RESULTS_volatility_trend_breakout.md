# Independent replication — Volatility Trend Breakout

The Pine rules were ported to Python (`strategies/python/volatility_trend_breakout.py`)
and run against **Twelve Data** XAU/USD candles, a different feed from the TradingView
chart. Nothing was tuned. This is the first time the strategy has been measured
outside the tool that produced it.

## The headline: it replicates

| | TradingView (their chart) | Python port (Twelve Data) |
|---|---|---|
| Window | 2023-01-02 → 2026-09-17 | 2023-01-03 → 2026-09-16 |
| Timeframe | as charted | 4H |
| Closed legs | 178 | 213 |
| Win rate | 74.16% | 72.30% |
| Profit factor | 1.938 | 1.750 |
| Net | +40.69% | +38.76% |
| Max drawdown | 5.50% | 5.26% |

Two different data feeds, two different engines, the same answer. That is much
stronger evidence than a single Strategy Tester screenshot, and it rules out the
result being a TradingView artefact.

The port runs **without the volume filter**, because the Twelve Data series carries
no volume for spot gold. That explains the extra trades (213 against 178) and most
of the profit-factor gap. It also suggests the volume filter is doing real work and
should be reproduced against whatever feed the system trades on.

## The inverse baseline fails hard, which is what you want

| | Strategy | Inverse |
|---|---|---|
| Profit factor | 1.750 | 0.571 |
| Net | +38.76% | −40.94% |
| Max drawdown | 5.26% | 45.22% |
| Expectancy per position | +0.344 R | −0.295 R |
| Longest losing streak | 4 legs | 12 legs |

Reversing the direction destroys the result. The edge is in the rules and the
direction together, not in an accidentally profitable exit scheme.

## Audit finding 1 was wrong, and the test says so

I flagged the TP1 market-at-close fill as the largest risk in the result. Measured
both ways on the same data:

| TP1 fill model | Profit factor | Net |
|---|---|---|
| Limit order at TP1 (realistic) | 1.926 | +25.34% |
| Market at bar close (Pine v1) | 1.952 | +26.28% |

A 1.3% difference in profit factor. The concern was real in principle and immaterial
in practice. The v2 script keeps the limit-order version because it is what a live
account does, not because it changes the numbers.

## The regime test, and this one is a warning

Daily gold, 2011-2019, which covers the 2012-2015 bear market and the flat years:

| | Strategy | Inverse |
|---|---|---|
| Closed legs | 58 | 62 |
| Win rate | 56.90% | 51.61% |
| Profit factor | 0.864 | 0.776 |
| Net over 9 years | −3.72% | −6.51% |
| Max drawdown | 11.20% | 6.51% |

Outside an uptrend the strategy bleeds slowly rather than collapsing: it lost 3.7%
across nine years while the inverse lost more. That is the honest shape of a
long-only breakout. It is not evidence of an edge in that regime, and with 58 legs
it is not statistically conclusive either, but it does say the strategy will not
destroy an account when gold stops trending. It will chop sideways and cost fees.

Caveat: that run used daily bars because 4H history does not reach back that far on
this feed. Daily and 4H are not the same strategy, so treat it as directional
evidence, not a verdict.

## What this clears, and what it does not

Cleared:

- Replication on an independent data source.
- Inverse-direction baseline, decisively.
- 100+ closed legs on the main window (213).
- Costs applied throughout: 0.04% per side plus 2 ticks of slippage.
- The fill-model concern, measured and dismissed.

Not cleared:

- Walk-forward with parameters fixed before each fold. Everything here uses one
  parameter set across the whole window.
- Deflated Sharpe ratio.
- A 4H run in a bear regime.
- The volume filter, which could not be tested on this feed.
- Live spread behaviour around releases, which no backtest on this data can show.

## How to reproduce

```bash
python3 strategies/python/volatility_trend_breakout.py candles.csv --tf 4h --both
python3 strategies/python/volatility_trend_breakout.py candles.csv --tf 4h --tp1-model close
python3 strategies/python/volatility_trend_breakout.py candles.csv --tf 4h --max-leverage 0
```

CSV needs `datetime, open, high, low, close, volume`. Add `--no-volume-filter` when
the feed has no volume. The engine was checked against a random walk first, where it
returns a profit factor near 1.0 and a small loss, which is what an unbiased engine
must do on data with no edge.
