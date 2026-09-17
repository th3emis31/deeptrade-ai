# Audit — Volatility Trend Breakout (Better Exits + Dashboard)

Source reviewed: Pine v5, the script behind the 2023-2026 row of 178 trades,
74.16% wins, profit factor 1.938, 5.50% max drawdown, +40.69% on 10K.

## What passes, and it is more than usual

- **No repainting.** There is not a single `request.security` call. Everything is
  computed on the chart timeframe from closed-bar values. The repaint risk that
  voided my earlier concerns does not exist here.
- **Costs are set and they are conservative.** 0.04% commission per side on gold
  at ~4,100 is roughly six to ten times a typical broker spread of 0.15 to 0.25
  per ounce. The headline result is already after costs.
- **Sizing is genuine risk sizing.** The `percent_of_equity` header is overridden
  by the explicit `qty` on every entry, computed as 0.85% of equity divided by the
  real stop distance. That is the correct way to do it.
- **Entry logic uses only closed-bar information.** `close > upper[1]` plus a 0.35
  ATR buffer. No forward reference.
- **State is reset on each entry**, so no leakage between trades.

## Finding 1 — TP1 is modelled at the bar close, not at TP1 (MEASURED: immaterial)

> **Update, same day.** The Python port measured both fill models on the same
> data: profit factor 1.926 with a real limit order against 1.952 with the
> market-at-close model, a difference of 1.3%. The concern below was correct in
> principle and wrong in size. It is not carrying the result. See
> `RESULTS_volatility_trend_breakout.md`.

```pine
if not tp1Taken and high >= tp1Price
    strategy.close("Long", qty_percent=50, comment="TP1")
```

`strategy.close` issues a market order, and with `process_orders_on_close=true`
that order fills at **the closing price of the bar**, not at `tp1Price`.

In live trading this half would be a resting limit order that fills exactly at
`tp1Price`. In the backtest it fills wherever the bar happened to close after
touching TP1. On a breakout strategy the bars that reach TP1 are momentum bars
that tend to close near their high, so the modelled fill is on average **better
than the real one would be**. Some of the 74% win rate and some of the profit
factor come from this.

This is the single largest unknown in the result, and it is measurable: replace
it with a real limit order and rerun. `strategies/pine/volatility_trend_breakout_v2.pine`
does exactly that, behind a toggle so the original behaviour can still be reproduced.

If the result barely moves, the strategy is sound. If it drops sharply, the exits
were an artefact of the fill model rather than an edge.

## Finding 2 — no margin requirement, so leverage is unbounded (MEASURED: never bound)

> **Update, same day.** Across 136 positions on 4H gold 2023-2026, the 5x leverage
> cap was never reached: zero capped entries. Gold's ATR stayed wide enough that
> risk sizing never asked for more than 5x. The cap is worth keeping as a guard,
> but it is not changing any historical result. The concern below stands as a
> future risk, not a present one.

`strategy()` does not set `margin_long`, which means the tester assumes 0% margin
and therefore infinite leverage. Position size comes from risk divided by stop
distance, so in a low-volatility stretch the stop narrows and the notional grows.
Worked example at 10K equity, 0.85% risk:

| ATR | Stop distance | Quantity | Notional | Leverage |
|---|---|---|---|---|
| 25 | 37.5 | 2.27 oz | ~9,300 | 0.9x |
| 10 | 15.0 | 5.67 oz | ~23,200 | 2.3x |
| 5 | 7.5 | 11.3 oz | ~46,400 | 4.6x |

None of that is rejected by the tester, and a real broker would reject or margin
call it. The v2 file adds a leverage cap on the quantity and a `margin_long`
setting. If the equity curve changes after that, the original sizing was not
executable.

## Finding 3 — long only, inside a historic gold bull market

There is no short side. The entire 2023-2026 window is the strongest gold trend
in decades, so a long-only breakout is measuring the trend as much as the rules.
This does not invalidate anything, it just means the result is unproven outside
that regime. Run 2013-2018, which was flat to bearish gold. Expect it to be much
worse; what matters is whether it is merely flat or badly negative.

## Finding 4 — the volume filter will not port cleanly

`volume > volMa` uses the chart feed's tick volume. Spot gold has no exchange
volume, so the numbers come from whichever broker feed the chart uses, and a
different feed gives different values. When the rules move into the Python
engine, this filter will not reproduce the same trades. Either drop it and check
what it was contributing, or define it against the same feed the system trades on.

## Finding 5 — smaller things

- `close > upper[1] and close > upper[1] + atrMult * atr * 0.25` — the first
  condition is implied by the second and does nothing.
- `stopPrice`, `tp1Price` and the rest are assigned before the `qty > 0` guard,
  so a rejected entry still overwrites the state. Harmless today because the
  management block only runs when a position exists.
- No session filter and no news filter. Gold around a CPI or FOMC release is
  where a breakout system meets its worst slippage, and neither the spread widening
  nor the gap is in the backtest.
- `pnlPct >= 0` prints red when the value is `na`. Cosmetic.

## What the result is worth right now

Better than any previous row, and for honest reasons: no repainting, costs
applied, real risk sizing, 178 trades. Findings 1 and 2 are the two that can move
the numbers, and both can be settled with a rerun rather than an argument.

Order to test, one change at a time so you know which change did what:

1. TP1 as a real limit order (v2, `Use a real limit order for TP1` on).
2. Leverage cap and margin applied.
3. Same script on 2013-2018 gold.
4. Same script on BTCUSD, since the title claims both.

Record every row in `.claude/memory/BASELINE.md`, including the ones that get worse.
