#!/usr/bin/env python3
"""Measure two price-action concepts on the same engine as the breakout: FVG and CRT.

IMPORTANT, read before believing anything here. These are MY implementations of
two ideas that have no single agreed definition:

  FVG (fair value gap): a three-bar imbalance where bar i's low is above bar
      i-2's high. The unfilled space is the zone. The trade is a long when price
      retraces into that zone and holds it.

  CRT (candle range theory): a liquidity sweep. Price takes out the previous
      bar's low and closes back above it in the same bar, which is read as stops
      being taken before a move the other way.

A negative result here is evidence against THESE rules, not against however you
trade the concept. If your version differs, change the rules below and rerun —
that is the point of having the engine.

Both run long-only, with the same stop and target structure as the breakout
(1.5 ATR risk, half off at 1.3R, remainder at 2.8R) so the rows are comparable,
and the same costs. Each is also run inverted as a direction baseline.
"""

import argparse
import sys
from typing import List, Optional, Sequence

from volatility_trend_breakout import (Candle, Config, Signal, atr, ema, load_csv,
                                       backtest, format_report, metrics)


def fvg_signals(candles: Sequence[Candle], cfg: Config, zone_life: int = 30,
                use_trend: bool = True, stop_buffer_atr: float = 0.5) -> List[Signal]:
    a = atr(candles, cfg.atr_len)
    e = ema([c.close for c in candles], cfg.ema_len)
    out: List[Signal] = []
    open_zones: List[tuple] = []          # (created_index, bottom, top)

    for i in range(2, len(candles)):
        c = candles[i]
        # A new bullish imbalance: bar i's low sits above bar i-2's high.
        if c.low > candles[i - 2].high:
            open_zones.append((i, candles[i - 2].high, c.low))

        if a[i] is None:
            continue

        alive = []
        fired = False
        for created, bottom, top in open_zones:
            if i - created > zone_life:
                continue                      # expired, drop it
            if i <= created:
                alive.append((created, bottom, top))
                continue                      # created this bar, cannot trade it yet
            touched = c.low <= top and c.low >= bottom
            holding = c.close > bottom
            trend_ok = (not use_trend) or (e[i] is not None and c.close > e[i])
            if touched and holding and trend_ok and not fired:
                stop = bottom - stop_buffer_atr * a[i]
                risk = c.close - stop
                if risk > 0:
                    out.append(Signal(i, c.ts, "short" if cfg.inverse else "long",
                                      c.close,
                                      c.close + risk if cfg.inverse else stop,
                                      c.close - risk * cfg.tp1_r if cfg.inverse else c.close + risk * cfg.tp1_r,
                                      c.close - risk * cfg.tp2_r if cfg.inverse else c.close + risk * cfg.tp2_r,
                                      a[i], "retrace into bullish FVG %.2f-%.2f" % (bottom, top)))
                    fired = True
                continue          # a zone that has been traded is done
            alive.append((created, bottom, top))
        open_zones = alive
    return out


def crt_signals(candles: Sequence[Candle], cfg: Config, use_trend: bool = True,
                stop_buffer_atr: float = 0.25) -> List[Signal]:
    a = atr(candles, cfg.atr_len)
    e = ema([c.close for c in candles], cfg.ema_len)
    out: List[Signal] = []
    for i in range(1, len(candles)):
        if a[i] is None:
            continue
        c, prev = candles[i], candles[i - 1]
        swept = c.low < prev.low and c.close > prev.low and c.close > c.open
        trend_ok = (not use_trend) or (e[i] is not None and c.close > e[i])
        if not (swept and trend_ok):
            continue
        stop = c.low - stop_buffer_atr * a[i]
        risk = c.close - stop
        if risk <= 0:
            continue
        out.append(Signal(i, c.ts, "short" if cfg.inverse else "long", c.close,
                          c.close + risk if cfg.inverse else stop,
                          c.close - risk * cfg.tp1_r if cfg.inverse else c.close + risk * cfg.tp1_r,
                          c.close - risk * cfg.tp2_r if cfg.inverse else c.close + risk * cfg.tp2_r,
                          a[i], "swept prior low %.2f and closed back above" % prev.low))
    return out


def main(argv: Optional[Sequence[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--tf", default="?")
    ap.add_argument("--no-trend-filter", action="store_true",
                    help="drop the EMA50 bias filter, so the concept is tested on its own")
    args = ap.parse_args(argv)

    candles = load_csv(args.csv)
    print("bars: %d   %s -> %s   timeframe: %s   trend filter: %s\n"
          % (len(candles), candles[0].ts, candles[-1].ts, args.tf,
             "off" if args.no_trend_filter else "EMA50"))

    use_trend = not args.no_trend_filter
    for name, fn in (("FVG", fvg_signals), ("CRT", crt_signals)):
        for inverse in (False, True):
            cfg = Config(use_volume=False, inverse=inverse)
            sigs = fn(candles, cfg, use_trend=use_trend)
            m = metrics(backtest(candles, cfg, signals=sigs), cfg)
            print(format_report(m, "%s %s" % (name, "INVERSE" if inverse else "STRATEGY")))
            if m["closed_legs"] < 100:
                print("  NOTE: under 100 closed legs — insufficient evidence.")
            print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
