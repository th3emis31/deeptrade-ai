# Combining the strategies that already exist

Question answered here: can the Swing Trend Pullback (21/50 EMA, H1/H4/D1) be
combined with anything else already built? Yes — with one of them properly, with
two of them as filters, and with one of them not at all.

## The inventory, and what each one is good for

| Strategy | State today | Combines with the pullback? |
|---|---|---|
| Swing Trend Pullback v2 (21/50 EMA) | PF 1.64, 102 trades, 2023-2026, fixed size, costs unconfirmed | Base engine |
| Family C Mean Reversion SHORT (5M) | Data-mined thresholds, no holdout | Yes — opposite regime, opposite direction |
| Gold session pullback (`strategies/gold_session_pullback.md`) | Failed every variant | No. Same family as the trend pullback; stacking it adds correlated losses |
| RF + LSTM direction model | ~53-54% accuracy, walk-forward negative | Not as a signal. Only as a veto filter, and only if it measurably improves the row |
| Event defence / economic calendar | Works | Yes — shared guard for every engine |
| Gold Reaper EA | Profitable in sample, separate platform | Keep separate. It is a different account-level system; running both on one account doubles exposure without doubling the edge |

## Why Family C is the right partner

Two strategies are only worth combining when their equity curves are
uncorrelated. These two are structurally uncorrelated rather than accidentally:

- The pullback needs a trend and buys weakness inside it.
- Family C needs compressed volatility and fades an acceleration.
- The pullback trades both directions; Family C is short only.
- The pullback lives on H1 and above; Family C lives on 5M.

That means the market state where one is at its worst is roughly the state where
the other is at its best. A dead range bleeds the pullback and feeds Family C; a
strong trend feeds the pullback and runs Family C over.

## How the router arbitrates

`pine/gold_router_v1.pine` implements it. The rules:

1. **One position at a time.** `pyramiding=0`. Two engines never hold opposite
   sides of the same instrument, which would pay the spread twice to be flat.
2. **Regime decides who speaks.** ADX on the Engine A timeframe. At or above the
   threshold the market is trending and only the pullback may trade. Below it,
   Family C may trade.
3. **Daily bias gates direction.** Close above the daily EMA allows longs only;
   below it allows shorts. This is what turns the separate H1, H4 and D1 results
   into one system instead of three.
4. **Engine A has priority.** Family C is muted for N bars after any pullback
   signal, so a fade cannot fire into a fresh trend setup.
5. **Shared guards, applied once:** session window, news blackout, ATR
   circuit breaker, max trades per day, daily loss kill switch.
6. **Shared risk budget.** Size comes from the real stop distance at a fixed
   percent of equity, so a Family C trade and a pullback trade risk the same
   amount. The daily loss stop counts both.

## The test that decides whether the combination is worth anything

Run three backtests on identical settings, costs on, percent sizing on:

1. Engine A alone (Engine B off)
2. Engine B alone (Engine A off)
3. Both on

The combination only earns its place if row 3 beats the better of rows 1 and 2
on **both** profit factor and maximum drawdown. If it only beats them on profit,
it is taking more risk for more return and you can get the same by raising the
risk percent on the single better engine.

Then run the same three through the local Strategy Lab with the inverse-direction
baseline and the tier-1 event filter, and record the rows in `BASELINE.md`.
Promotion rules are unchanged: 100+ out-of-sample trades, profit factor above 1.3
after costs, inverse baseline worse, deflated Sharpe at or above 0.95.

## What is not proven

Nothing in the router has been forward-tested. Family C's four thresholds carry
six decimal places, which is the signature of a fit to one dataset. The news
window is a clock, not a calendar. Treat the file as a structure for testing the
combination, not as a system with a known edge.
