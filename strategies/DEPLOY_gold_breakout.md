# Deployment sheet — Volatility Trend Breakout (XAUUSD)

Decision taken: the strategy is trend-dependent and that is accepted. Gold is
trending, the strategy harvests trends, and when the trend ends the measured cost
of being wrong is small. This sheet says how to run it and what would change the
decision.

## Settings

| Setting | Value | Why |
|---|---|---|
| Symbol / timeframe | XAUUSD, 4H | The window that produced 213 legs and matched TradingView |
| Risk per trade | 0.85% of equity | The tested value. 1.0% scales linearly and was also measured |
| Stop | 1.5 ATR(14) | Unchanged from the script |
| TP1 / final TP | 1.3R on half / 2.8R | Unchanged |
| Trail after TP1 | 2.2 ATR | Unchanged |
| Max bars in trade | 65 | Unchanged |
| Leverage cap | 5x | Never bound in 136 positions. A forward guard only |
| Regime gate | off to start | It costs profit in a strong trend. See the switch below |
| Costs to assume | 0.04% per side, 2 ticks | Conservative against a real gold spread |

## What "the trend is on" means, concretely

Do not judge this by eye. One rule, checked once a day on the daily chart:

- **Trend on**: daily close above the 200-period EMA.
- **Trend off**: daily close below the 200-period EMA for three consecutive days.

When the trend goes off, switch the regime gate on rather than stopping entirely.
That is what the measurement supports: across 2004-2019 the gate produced the same
net profit for half the drawdown, and turned the losing stretch from −3.72% into
−0.65%. The filter is not there to make more money. It is there to make the bad
years quiet.

## What normal looks like, so you can spot abnormal

Measured across two independent bull markets and two data feeds:

| Metric | Expected | Investigate below / above |
|---|---|---|
| Win rate | 70-74% | Below 60% over 30 legs |
| Profit factor | 1.75-1.95 | Below 1.3 over 50 legs |
| Average win / average loss | ~0.68 | Below 0.55 |
| Longest losing streak | 3-4 legs | 6 or more |
| Max drawdown | 3-6% of peak | 10% |

A win rate drift is the early warning. This strategy wins small and often, so the
win rate is what carries it. When that slips, the payoff ratio cannot compensate.

## Kill switches, in order

1. Drawdown reaches 10% of peak equity → stop, review, do not re-enable the same day.
2. Six consecutive losing legs → stop until reviewed against this sheet.
3. Demo win rate more than ten points below 70% after 20 trades → the backtest was
   optimistic; back to testing.
4. Tier-1 event window (FOMC, CPI, NFP) → no new entries. Gold breakouts into a
   release are where the spread eats the edge.

## What is still not proven, stated once

Walk-forward with parameters fixed before each fold has not run. No live or demo
trade has happened. Everything above comes from backtests with modelled costs.
The first twenty demo trades are worth more than every backtest in this repository,
because they are the only numbers that include a real spread.

## Order of operations

1. Demo forward test on the Vantage demo, 0.85% risk, event windows and kill
   switches active.
2. Walk-forward in the Strategy Lab in parallel, which decides the regime gate.
3. Compare the demo row against this sheet's "expected" column after 20 trades.
4. Real money is a decision for the owner, taken after step 3, never before.
