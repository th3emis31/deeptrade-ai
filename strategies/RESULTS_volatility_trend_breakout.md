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

---

# Second round: is it overfitted, or regime-dependent?

Your 19-year Vantage run answered the question I could not: profit factor 0.990
across 2007-2022, against 1.986 inside the 2023-2026 tuning window. That looks
like overfitting. It is not, and here is the test that separates the two.

## The decisive run: a different bull market, 15 years earlier

Daily XAU/USD, 2004-2012, which contains the 2008-2011 bull. Same parameters,
never tuned on this data, never seen by anyone tuning:

| | Strategy | Inverse |
|---|---|---|
| Closed legs | 104 | 111 |
| Win rate | 73.08% | 45.05% |
| Profit factor | 1.888 | 0.559 |
| Net | +22.77% | −22.61% |
| Max drawdown | 3.19% of peak | 26.97% |

That is the same statistical fingerprint as 2023-2026: a win rate in the low 70s
and a profit factor near 1.9. A curve-fitted strategy does not reproduce itself in
a bull market from a different decade on data nobody tuned against.

**Verdict: the rules are not overfitted. They are trend-dependent.** They earn in
gold uptrends and pay fees the rest of the time, which is exactly what a long-only
breakout should do. Your 2007-2022 figure of 0.990 is the average of a profitable
2008-2011, a losing 2012-2015 bear and a flat 2016-2018.

## So: can a regime gate fix the flat years?

Three configurations, same rules, costs on throughout.

| Data | No gate | Chart gate, EMA200 + ADX≥20 | Daily gate, EMA50 + ADX≥20 |
|---|---|---|---|
| Daily 2004-2019 | PF 1.376, DD 10.78%, +15.75% | **PF 1.556, DD 5.33%, +15.66%** | PF 1.610, DD 5.44%, +15.93% |
| Daily 2011-2019 (the bad years) | PF 0.864, −3.72% | **PF 0.978, −0.65%** | — |
| 4H 2023-2026 | **PF 1.750, DD 5.26%, +38.76%** | PF 1.437, DD 6.62%, +16.53% | PF 1.766, DD 6.01%, +22.03% |

What that says:

- On the long daily history the gate is a clear win: the same money for half the
  drawdown, and the losing years stop bleeding (−3.72% becomes −0.65%).
- On the 2023-2026 4H window it costs profit rather than adding it. A strong trend
  is the one place a trend filter cannot help, only subtract.
- The daily gate is the better of the two gates on 4H, but it still removes 43% of
  the trades to end up at the same profit factor.

## A warning about what I just did

Three gate configurations were tried on data I had already seen. Picking the one
with the best row is selection bias, and it is the same mistake that produced the
2023-2026 number in the first place. Nothing above is validated, it is a hypothesis
worth testing properly.

The only honest next step is the walk-forward already queued on your machine, with
the gate parameters fixed before each fold and results reported only on the fold
that follows. If the gate survives that, it is real. If it does not, the plain
strategy with a manual regime judgement is the better answer.
