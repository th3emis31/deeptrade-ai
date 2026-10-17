# FVG and CRT, measured

Tested on the same engine, the same gold data, the same costs and the same stop
and target structure as the breakout, so the rows are directly comparable.

My implementations, stated plainly because neither concept has one agreed definition:

- **FVG**: a three-bar imbalance where bar i's low is above bar i-2's high. The
  unfilled space is the zone. Long when price retraces into the zone and closes
  above its bottom, within 30 bars of the zone forming. Stop half an ATR below
  the zone.
- **CRT**: a liquidity sweep. Price takes out the previous bar's low and closes
  back above it in the same bar, with a bullish close. Stop a quarter ATR below
  that low.

Both use the EMA50 bias filter and both are long-only, with the inverse run as a
direction baseline.

## 4H gold, 2023-2026

| | Closed legs | Win rate | Profit factor | Net | Max drawdown |
|---|---|---|---|---|---|
| Breakout | 213 | 72.30% | 1.750 | +38.76% | 5.26% |
| FVG | 322 | 64.29% | 1.225 | +12.12% | 10.35% |
| CRT | 442 | 66.97% | 1.218 | +7.53% | 16.59% |
| FVG inverse | 323 | 53.87% | 0.632 | −45.45% | 47.15% |
| CRT inverse | 426 | 52.82% | 0.615 | −61.99% | 62.42% |

Both concepts are profitable here and both inverses fail badly, so neither is
noise. In a strong trend the breakout is the better tool.

## Daily gold, 2004-2019 — bull, bear and chop together

| | Closed legs | Win rate | Profit factor | Net | Max drawdown |
|---|---|---|---|---|---|
| **FVG** | **227** | **66.52%** | **1.390** | **+27.22%** | **9.81%** |
| Breakout | 147 | 67.35% | 1.376 | +15.75% | 10.78% |
| CRT | 255 | 64.31% | 1.207 | +12.67% | 9.18% |
| FVG inverse | 260 | 55.38% | 0.801 | −21.51% | 22.03% |
| CRT inverse | 261 | 54.79% | 0.723 | −28.41% | 28.61% |

**This is the finding that matters.** Across sixteen years containing a bull
market, a bear market and years of chop, FVG returned 27.22% against the
breakout's 15.75%, with a slightly better profit factor and a slightly smaller
drawdown. It also traded 227 times against 147, so there is more evidence behind
it.

The breakout only earns in uptrends. FVG earned across all three regimes. That is
the opposite of what I expected, and it is the strongest argument yet for running
them together rather than choosing between them: FVG as the all-weather base,
the breakout as the trend accelerator.

## Honesty notes

- A bug in my first FVG implementation produced zero trades, because a zone was
  discarded on the bar that created it. Found and fixed before these numbers were
  produced. My tests can be wrong, and when they are, they get fixed and rerun.
- These are my rules, not yours. If your FVG or CRT entries differ, edit
  `fvg_crt_backtest.py` and rerun. A weak row for my version says nothing about
  yours.
- Long-only in gold, which spent most of this period rising. The inverse baselines
  argue against that being the whole story, but it is still part of it.
- No walk-forward, no live spread, no demo trades. Same caveats as everything else
  in this repository.

---

# Combined: does running them together win?

One account, one position at a time, earliest signal wins, same costs and risk.

## 4H gold 2023-2026 (a strong uptrend)

| | Legs | Win rate | Profit factor | Net | Max drawdown |
|---|---|---|---|---|---|
| **Breakout alone** | 213 | 72.30% | **1.750** | **+38.76%** | **5.06%** |
| Breakout + FVG | 363 | 66.12% | 1.317 | +24.99% | 8.12% |
| Breakout + FVG + CRT | 499 | 64.53% | 1.138 | +1.23% | 14.60% |

In a strong trend, adding anything to the breakout makes it worse. The extra
trades occupy the account and block the better ones.

## Daily gold 2004-2019 (bull, bear and chop)

| | Legs | Win rate | Profit factor | Net | Max drawdown |
|---|---|---|---|---|---|
| **Breakout + FVG** | 260 | 66.54% | **1.393** | **+32.36%** | **8.98%** |
| FVG alone | 227 | 66.52% | 1.390 | +27.22% | 9.81% |
| Breakout alone | 147 | 67.35% | 1.376 | +15.75% | 10.78% |
| Breakout + FVG + CRT | 322 | 65.22% | 1.276 | +26.70% | 10.62% |

Across mixed regimes the pair beats either component on profit and on drawdown
at once, which is the only combination result worth having. The two do not fire
at the same time: the breakout takes the trending stretches and the fair value
gaps take the rest.

## Conclusions

1. **Breakout + FVG is the pair.** More profit and less drawdown than either
   alone across sixteen years of mixed conditions.
2. **CRT comes out.** It dilutes both portfolios. It is mildly profitable alone
   and it is not additive, which is the thing that matters in a portfolio.
3. **In a confirmed strong trend, the breakout alone is better.** That is an
   argument for the regime switch in the deployment sheet, not against the pair.

## The limit of what more backtesting can tell us

This is roughly the twentieth configuration measured on the same gold history.
Each new one raises the chance that the best row is the luckiest row rather than
the best strategy. Nothing further should be decided by trying another variant on
this data. The remaining questions need new information: walk-forward with
parameters fixed before each fold, a different instrument, or live demo fills.

---

# Out-of-sample: instruments that had nothing to do with building this

## BTCUSD 4H, June 2024 to September 2026

| | Legs | Win rate | Profit factor | Net | Max drawdown |
|---|---|---|---|---|---|
| **FVG alone** | 195 | 67.18% | **1.303** | **+15.80%** | **5.19%** |
| Breakout + FVG | 213 | 63.38% | 1.100 | +3.88% | 10.91% |
| Breakout alone | 115 | 59.13% | 0.975 | −2.52% | 8.11% |
| CRT alone | 239 | 58.16% | 0.962 | −8.61% | 19.85% |

Fair value gaps carried to a different asset class: 195 legs, profit factor 1.303,
a 5.19% drawdown. Nothing about this data was involved in designing the rules.
The breakout did not carry, which fits what we already know about it needing a
trend, and Bitcoin spent much of this window ranging.

## EURUSD daily, 2004-2019

| | Legs | Win rate | Profit factor | Net |
|---|---|---|---|---|
| FVG alone | 207 | 63.29% | 1.093 | +5.32% |
| Breakout + FVG | 229 | 63.32% | 1.079 | +4.80% |
| Breakout alone | 61 | 57.38% | 1.051 | +0.81% |
| CRT alone | 249 | 57.83% | 0.904 | −11.20% |

Barely above break-even. Honest reading: on a major currency pair over sixteen
years these rules have no meaningful edge, and a profit factor of 1.09 would not
survive a wider spread.

### The bug that nearly produced a false answer

The first EURUSD run showed profit factors near 0.02 and losses of 80%. That was
not the strategy. The tick size defaulted to 0.01, which is correct for gold and
Bitcoin and catastrophically wrong for a 1.20 instrument: two ticks of slippage
became 0.02, larger than the entire 1.5 ATR stop. Every trade paid more in
slippage than it risked.

`portfolio_backtest.py` now warns when slippage exceeds 10% of a typical stop
distance, so the same mistake announces itself instead of reading as a result.

## Where the evidence stands

| Instrument | FVG | Breakout |
|---|---|---|
| Gold, daily 2004-2019 | 1.390 | 1.376 |
| Gold, 4H 2023-2026 | 1.225 | 1.750 |
| Bitcoin, 4H 2024-2026 | 1.303 | 0.975 |
| EURUSD, daily 2004-2019 | 1.093 | 1.051 |

FVG is positive on all four, across two asset classes and two decades, which is
the most robust thing measured in this repository. The breakout is stronger than
FVG in a gold uptrend and weaker everywhere else. Neither is strong on EURUSD.
