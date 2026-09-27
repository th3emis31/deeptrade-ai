#!/usr/bin/env python3
"""Work out the instrument's settings from the data instead of asking a human.

Every wrong result this project produced came from a parameter a person had to
supply and got wrong: a tick size meant for gold applied to EURUSD, an ATR
fraction measured on hourly bars applied to 15-minute bars. So nothing here is
asked for. It is detected, reported with the reason, and can still be overridden.

    from detect import detect
    setup = detect(candles, raw_csv_path)
    print(setup.explain())
"""

from __future__ import annotations

import csv
import datetime as dt
import re
from dataclasses import dataclass, field
from typing import List, Optional, Sequence

TIMEFRAMES = [
    (60, "1m"), (300, "5m"), (900, "15m"), (1800, "30m"), (3600, "1h"),
    (7200, "2h"), (14400, "4h"), (21600, "6h"), (28800, "8h"),
    (43200, "12h"), (86400, "1d"), (604800, "1w"),
]


@dataclass
class Setup:
    timeframe: str = "?"
    bar_seconds: Optional[int] = None
    mintick: float = 0.01
    instrument_class: str = "unknown"
    commission_pct: float = 0.04
    typical_price: float = 0.0
    median_bar_range: float = 0.0
    decimals_seen: Optional[int] = None
    reasons: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def explain(self) -> str:
        head = ("detected: %s bars, %s, tick %s, commission %.3f%% per side"
                % (self.timeframe, self.instrument_class, self.mintick, self.commission_pct))
        body = "\n".join("    because %s" % r for r in self.reasons)
        warn = "\n".join("    WARNING %s" % w for w in self.warnings)
        return "\n".join(x for x in (head, body, warn) if x)


def _parse_ts(value: str) -> Optional[dt.datetime]:
    value = value.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M",
                "%Y-%m-%d", "%d/%m/%Y %H:%M", "%Y.%m.%d %H:%M"):
        try:
            return dt.datetime.strptime(value[:len(fmt) + 2].strip(), fmt)
        except ValueError:
            continue
    return None


def detect_timeframe(timestamps: Sequence[str]) -> tuple:
    """Median gap between bars, snapped to the nearest standard timeframe."""
    parsed = [t for t in (_parse_ts(s) for s in timestamps[:4000]) if t is not None]
    if len(parsed) < 3:
        return "?", None, "no parsable timestamps, so the timeframe is unknown"
    gaps = sorted((parsed[i + 1] - parsed[i]).total_seconds()
                  for i in range(len(parsed) - 1)
                  if (parsed[i + 1] - parsed[i]).total_seconds() > 0)
    if not gaps:
        return "?", None, "timestamps do not advance"
    median = gaps[len(gaps) // 2]
    label, seconds = min(((lab, sec) for sec, lab in TIMEFRAMES),
                         key=lambda pair: abs(pair[1] - median))
    note = ("the median gap between bars is %.0f seconds, closest to %s" % (median, label))
    if abs(seconds - median) > seconds * 0.25:
        note += " (a poor match: the data may have gaps or mixed timeframes)"
    return label, seconds, note


def decimals_in_csv(path: str, limit: int = 500) -> Optional[int]:
    """How many decimal places the FILE uses. The most direct evidence of tick size."""
    try:
        with open(path, newline="") as fh:
            reader = csv.DictReader(fh)
            if not reader.fieldnames:
                return None
            cols = {c.lower().strip(): c for c in reader.fieldnames}
            close = cols.get("close")
            if not close:
                return None
            best = 0
            for i, row in enumerate(reader):
                if i >= limit:
                    break
                m = re.search(r"\.(\d+)", str(row.get(close, "")))
                if m:
                    best = max(best, len(m.group(1).rstrip("0")))
            return best
    except OSError:
        return None


def detect(candles, csv_path: Optional[str] = None) -> Setup:
    setup = Setup()
    if not candles:
        setup.warnings.append("no candles supplied")
        return setup

    closes = sorted(c.close for c in candles)
    setup.typical_price = closes[len(closes) // 2]
    ranges = sorted(c.high - c.low for c in candles)
    setup.median_bar_range = ranges[len(ranges) // 2]

    setup.timeframe, setup.bar_seconds, note = detect_timeframe([c.ts for c in candles])
    setup.reasons.append(note)

    decimals = decimals_in_csv(csv_path) if csv_path else None
    setup.decimals_seen = decimals

    price = setup.typical_price
    # Class first, from the price scale. Then the tick, from the file's own decimals
    # but never finer than the class allows — API feeds often carry spurious decimals.
    if price < 10:
        setup.instrument_class = "fx pair"
        floor_tick, default_comm = 0.00001, 0.01
    elif price < 200:
        setup.instrument_class = "low-priced instrument (fx cross, silver or a share)"
        floor_tick, default_comm = 0.001, 0.02
    elif price < 5000:
        setup.instrument_class = "metal or index (gold-like)"
        floor_tick, default_comm = 0.01, 0.04
    else:
        setup.instrument_class = "high-priced instrument (bitcoin-like)"
        floor_tick, default_comm = 0.01, 0.04
    setup.reasons.append("the median price is %.5g, which reads as a %s"
                         % (price, setup.instrument_class))

    if decimals is not None and decimals > 0:
        from_file = 10.0 ** (-decimals)
        setup.mintick = max(from_file, floor_tick)
        if from_file < floor_tick:
            setup.reasons.append("the file carries %d decimals, finer than this instrument trades; "
                                 "using %s instead" % (decimals, floor_tick))
        else:
            setup.reasons.append("the file's prices carry %d decimals" % decimals)
    else:
        setup.mintick = floor_tick
        setup.reasons.append("no decimals found in the file, so the class default is used")

    setup.commission_pct = default_comm

    # The check that would have caught the EURUSD disaster before it printed a table.
    slip = 2 * setup.mintick
    if setup.median_bar_range > 0 and slip > setup.median_bar_range * 0.5:
        setup.warnings.append(
            "two ticks of slippage (%.5f) is over half a typical bar (%.5f). Either the tick is "
            "wrong or this instrument is too illiquid to test this way."
            % (slip, setup.median_bar_range))
    return setup


if __name__ == "__main__":
    import sys
    from volatility_trend_breakout import load_csv
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(2)
    path = sys.argv[1]
    print(detect(load_csv(path), path).explain())
