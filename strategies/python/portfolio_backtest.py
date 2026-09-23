#!/usr/bin/env python3
"""Does running the strategies together beat running the best one alone?

Merges the signal streams and feeds them to the shared engine, which holds one
position at a time. The earliest signal wins; anything that fires while a trade
is open is skipped, exactly as a single account would behave.

Compared against each strategy alone on the same data, costs and risk.
"""

import argparse
import sys
from typing import List, Optional, Sequence

from volatility_trend_breakout import (Config, Signal, backtest, format_report,
                                       generate_signals, load_csv, metrics)
from fvg_crt_backtest import crt_signals, fvg_signals


def merge(*streams: Sequence[Signal]) -> List[Signal]:
    out: List[Signal] = []
    for s in streams:
        out.extend(s)
    out.sort(key=lambda x: x.index)
    return out


def main(argv: Optional[Sequence[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--tf", default="?")
    ap.add_argument("--mintick", type=float, default=0.01,
                    help="price increment of the instrument. 0.01 for gold and BTC, 0.0001 for most FX. "
                         "Getting this wrong turns slippage into a fortune and every row into nonsense.")
    ap.add_argument("--commission", type=float, default=0.04, help="percent per side")
    ap.add_argument("--regime-daily", action="store_true",
                    help="apply the daily regime gate to the breakout leg only")
    args = ap.parse_args(argv)

    candles = load_csv(args.csv)
    print("bars: %d   %s -> %s   timeframe: %s\n"
          % (len(candles), candles[0].ts, candles[-1].ts, args.tf))

    cfg = Config(use_volume=False, use_regime=args.regime_daily, regime_daily=args.regime_daily,
                 mintick=args.mintick, commission_pct=args.commission)
    flat = Config(use_volume=False, mintick=args.mintick, commission_pct=args.commission)

    # Sanity guard: slippage must be small against the risk the strategy takes.
    from volatility_trend_breakout import atr as _atr
    a = [x for x in _atr(candles, flat.atr_len) if x is not None]
    if a:
        typical_risk = flat.sl_atr_mult * (sum(a) / len(a))
        slip = flat.slippage_ticks * flat.mintick
        if slip > typical_risk * 0.1:
            print("WARNING: slippage of %.5f is %.1f%% of a typical %.5f stop distance. "
                  "The mintick is probably wrong for this instrument, and every row below is noise.\n"
                  % (slip, 100.0 * slip / typical_risk, typical_risk))

    brk = generate_signals(candles, cfg)
    fvg = fvg_signals(candles, flat)
    crt = crt_signals(candles, flat)

    combos = [
        ("BREAKOUT alone", brk),
        ("FVG alone", fvg),
        ("CRT alone", crt),
        ("BREAKOUT + FVG", merge(brk, fvg)),
        ("BREAKOUT + FVG + CRT", merge(brk, fvg, crt)),
    ]

    print("%-24s %7s %7s %8s %10s %9s %9s" %
          ("", "legs", "win%", "PF", "net %", "maxDD%", "R/pos"))
    print("-" * 80)
    for name, sigs in combos:
        m = metrics(backtest(candles, flat, signals=sigs), flat)
        pf = m["profit_factor"]
        print("%-24s %7d %7.2f %8.3f %10.2f %9.2f %9.3f" %
              (name, m["closed_legs"], m["win_rate_pct"],
               pf if pf < 99 else 99.0, m["net_pct"], m["max_dd_pct"],
               m["expectancy_r_per_position"]))
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
