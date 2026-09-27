#!/usr/bin/env python3
"""Read the chart objectively: what the rules see right now, not what the eye sees.

Give it the candles your terminal is showing and it prints the state of every
condition the strategies care about, plus what each one would do on the latest
closed bar. No screenshots, no guessing from pixels.

    python chart_report.py xauusd_4h.csv --tf 4H --symbol XAUUSD

CSV needs a header with datetime, open, high, low, close (volume optional).
MT5: Tools > History Center, or export from the chart. MT4: File > Save As.
"""

import argparse
import sys
from typing import List, Optional, Sequence

from volatility_trend_breakout import (Candle, Config, adx, atr, ema, generate_signals,
                                       load_csv, rolling_max, rolling_min, rsi, to_daily)
from fvg_crt_backtest import crt_signals, fvg_signals


def fmt(v, nd=2):
    return "n/a" if v is None else ("%.*f" % (nd, v))


def open_fvg_zones(candles: Sequence[Candle], life: int = 30) -> List[tuple]:
    """Bullish imbalances from the last `life` bars that price has not yet filled."""
    zones = []
    start = max(2, len(candles) - life)
    for i in range(start, len(candles)):
        if candles[i].low > candles[i - 2].high:
            bottom, top = candles[i - 2].high, candles[i].low
            # Still open if nothing since has traded below the bottom.
            filled = any(c.low <= bottom for c in candles[i + 1:])
            zones.append((candles[i].ts, bottom, top, not filled))
    return zones


def main(argv: Optional[Sequence[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--tf", default="?")
    ap.add_argument("--symbol", default="?")
    ap.add_argument("--digits", type=int, default=2)
    args = ap.parse_args(argv)

    c = load_csv(args.csv)
    if len(c) < 210:
        sys.stderr.write("Need at least 210 bars for the 200 EMA. Got %d.\n" % len(c))
        return 2

    cfg = Config(use_volume=False)
    nd = args.digits
    last = c[-1]
    closes = [x.close for x in c]

    e50 = ema(closes, 50)[-1]
    e200 = ema(closes, 200)[-1]
    a14 = atr(c, 14)[-1]
    r14 = rsi(closes, 14)[-1]
    adx14 = adx(c, 14)[-1]
    don_hi = rolling_max([x.high for x in c], 20)[-2]
    don_lo = rolling_min([x.low for x in c], 20)[-2]

    dailies, _ = to_daily(c)
    d_closed = dailies[-2] if len(dailies) >= 2 else None
    d_e200 = ema([d.close for d in dailies], 200)[-2] if len(dailies) > 201 else None
    d_e50 = ema([d.close for d in dailies], 50)[-2] if len(dailies) > 51 else None

    print("=" * 66)
    print(" %s  %s   last closed bar %s" % (args.symbol, args.tf, last.ts))
    print("=" * 66)
    print(" price   %s      bar range %s - %s"
          % (fmt(last.close, nd), fmt(last.low, nd), fmt(last.high, nd)))
    print(" ATR14   %s      RSI14 %s      ADX14 %s"
          % (fmt(a14, nd), fmt(r14, 1), fmt(adx14, 1)))
    print()

    print(" TREND")
    for name, val in (("EMA50", e50), ("EMA200", e200)):
        if val is None:
            print("   %-7s n/a" % name)
            continue
        side = "above" if last.close > val else "BELOW"
        dist = abs(last.close - val)
        print("   %-7s %s   price is %s by %s (%.2f ATR)"
              % (name, fmt(val, nd), side, fmt(dist, nd), dist / a14 if a14 else 0))
    if d_e200 is not None and d_closed is not None:
        on = d_closed.close > d_e200
        print("   daily close %s vs daily EMA200 %s  ->  TREND %s"
              % (fmt(d_closed.close, nd), fmt(d_e200, nd), "ON" if on else "OFF"))
        if not on:
            print("   deployment rule: three daily closes below this switches the regime gate on")
    if d_e50 is not None and d_closed is not None:
        print("   daily bias: %s the daily EMA50 (%s)"
              % ("above" if d_closed.close > d_e50 else "BELOW", fmt(d_e50, nd)))
    print()

    print(" BREAKOUT (Donchian 20 + 0.35 ATR buffer)")
    if don_hi is not None and a14 is not None:
        trigger = don_hi + cfg.atr_mult * a14 * 0.25
        gap = trigger - last.close
        print("   20-bar high %s   trigger above %s" % (fmt(don_hi, nd), fmt(trigger, nd)))
        print("   20-bar low  %s" % fmt(don_lo, nd))
        if gap <= 0:
            print("   TRIGGER LEVEL IS EXCEEDED on the last close")
        else:
            print("   %s away (%.2f ATR) from triggering" % (fmt(gap, nd), gap / a14 if a14 else 0))
        rsi_ok = r14 is not None and r14 > cfg.rsi_min
        ema_ok = e50 is not None and last.close > e50
        print("   filters: EMA50 %s | RSI>%.0f %s"
              % ("PASS" if ema_ok else "fail", cfg.rsi_min, "PASS" if rsi_ok else "fail"))
    print()

    print(" FAIR VALUE GAPS (bullish, last 30 bars)")
    zones = open_fvg_zones(c)
    live = [z for z in zones if z[3]]
    if not zones:
        print("   none formed")
    for ts, bottom, top, unfilled in zones[-6:]:
        where = "UNFILLED" if unfilled else "filled"
        inside = bottom <= last.close <= top
        print("   %s  %s - %s  %s%s"
              % (ts, fmt(bottom, nd), fmt(top, nd), where, "   <-- price is inside" if inside else ""))
    if live:
        nearest = min(live, key=lambda z: abs(last.close - z[2]))
        print("   nearest unfilled zone top %s, %s away"
              % (fmt(nearest[2], nd), fmt(abs(last.close - nearest[2]), nd)))
    print()

    print(" WHAT THE RULES WOULD DO ON THIS BAR")
    idx = len(c) - 1
    fired = False
    for label, sigs in (("breakout", generate_signals(c, cfg)),
                        ("fair value gap", fvg_signals(c, cfg)),
                        ("candle range sweep", crt_signals(c, cfg))):
        hit = [s for s in sigs if s.index == idx]
        if hit:
            s = hit[0]
            risk = abs(s.entry - s.stop)
            print("   %s: %s at %s | stop %s | TP1 %s | TP2 %s | risk %s (%.2f ATR)"
                  % (label.upper(), s.direction, fmt(s.entry, nd), fmt(s.stop, nd),
                     fmt(s.tp1, nd), fmt(s.tp2, nd), fmt(risk, nd), risk / a14 if a14 else 0))
            print("      why: %s" % s.reason)
            fired = True
        else:
            print("   %s: no signal" % label)
    if not fired:
        print("   Nothing to do. Waiting is a position.")
    print()
    print(" Reminder: this reads the last CLOSED bar. An unfinished bar can still change.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
