# Baseline metrics (append a row per backtest / model evaluation; never edit old rows)

| date | commit | type | strategy/model | period (OOS) | trades | win% | PF | expectancy (R) | max DD | Sharpe | notes |
|------|--------|------|----------------|--------------|--------|------|----|----------------|--------|--------|-------|
| 2026-09-17 | n/a | TradingView tester | Swing Trend Pullback v2 (21/50 EMA) | 1833-01-02 → 2026-09-17 (spliced) | — | — | — | — | — | — | Rejected: spliced data, profit only in gold bull runs, fixed size, costs unconfirmed |
| 2026-09-17 | n/a | TradingView tester | Swing Trend Pullback v2 (21/50 EMA) | 2023-01-02 → 2026-09-17 | 102 | 48.0 | 1.64 | — | 2.11% | — | +5.07% (~1.4%/yr) on fixed size. Real but small. Costs and sizing unconfirmed |
| 2026-09-17 | n/a | TradingView tester | Volatility Trend Breakout (Gold) | 2023-01-02 → 2026-09-17 | 152 | 69.08 | 1.855 | — | 6.64% | — | +3,670.28 on 10K = +36.70% (~8.5%/yr). Return/DD 5.5. Best row so far. Avg win / avg loss = 0.83, so wins are smaller than losses. Costs, sizing, repaint and inverse baseline all unconfirmed |
