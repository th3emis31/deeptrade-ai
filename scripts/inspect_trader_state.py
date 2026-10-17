#!/usr/bin/env python3
"""Find every copy of auto_trader_state.json and report which one still has the trades.

READ ONLY. This script opens files and zips and prints what it finds. It never
writes, moves, renames or deletes anything.

Usage (from anywhere):
    python inspect_trader_state.py
    python inspect_trader_state.py --root "C:\\Users\\th_em"
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import zipfile

NAME_HINT = "auto_trader_state"
ZIP_HINT = "auto_trader_state.json"


def when(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")


def describe(raw: bytes) -> dict:
    out = {"bytes": len(raw), "valid_json": False, "trades": None,
           "session_mode": None, "balance": None, "keys": None, "note": ""}
    if not raw.strip():
        out["note"] = "EMPTY FILE"
        return out
    try:
        data = json.loads(raw.decode("utf-8", "replace"))
    except json.JSONDecodeError as exc:
        out["note"] = "CORRUPT / TRUNCATED (%s)" % exc.msg
        return out
    if not isinstance(data, dict):
        out["note"] = "not a JSON object"
        return out
    out["valid_json"] = True
    out["keys"] = ",".join(sorted(data.keys()))
    trades = data.get("trades")
    out["trades"] = len(trades) if isinstance(trades, list) else "not a list"
    session = data.get("session")
    if isinstance(session, dict):
        out["session_mode"] = session.get("mode")
        out["balance"] = session.get("balance")
    return out


def scan_files(root: str) -> list:
    rows = []
    skip = {"node_modules", ".git", "__pycache__", "venv", ".venv", "AppData"}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for fn in filenames:
            if NAME_HINT not in fn.lower():
                continue
            path = os.path.join(dirpath, fn)
            try:
                with open(path, "rb") as fh:
                    info = describe(fh.read())
                info["mtime"] = when(os.path.getmtime(path))
            except OSError as exc:
                info = {"bytes": 0, "valid_json": False, "trades": None, "keys": None,
                        "session_mode": None, "balance": None,
                        "note": "unreadable: %s" % exc, "mtime": "?"}
            info["path"] = path
            info["kind"] = "file"
            rows.append(info)
    return rows


def scan_zips(root: str) -> list:
    rows = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in {"node_modules", ".git", "AppData"}]
        for fn in filenames:
            if not fn.lower().endswith(".zip"):
                continue
            path = os.path.join(dirpath, fn)
            try:
                with zipfile.ZipFile(path) as zf:
                    for member in zf.namelist():
                        if ZIP_HINT not in member.lower():
                            continue
                        info = describe(zf.read(member))
                        info["mtime"] = when(os.path.getmtime(path))
                        info["path"] = "%s :: %s" % (path, member)
                        info["kind"] = "zip"
                        rows.append(info)
            except (zipfile.BadZipFile, OSError):
                continue
    return rows


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=os.path.expanduser("~"),
                    help="folder to search (default: your user folder)")
    args = ap.parse_args(argv)

    print("Scanning %s  (read only, nothing is modified)\n" % args.root)
    rows = scan_files(args.root) + scan_zips(args.root)
    if not rows:
        print("No file matching '%s' found anywhere under that folder." % NAME_HINT)
        return 1

    def sort_key(r):
        t = r["trades"]
        return (-(t if isinstance(t, int) else -1), r["path"])

    rows.sort(key=sort_key)

    best = [r for r in rows if isinstance(r["trades"], int) and r["trades"] > 0]
    for r in rows:
        flag = "  <-- HAS TRADES" if (isinstance(r["trades"], int) and r["trades"] > 0) else ""
        print("%-7s %8s bytes  %s  trades=%-6s %s%s"
              % (r["kind"], r["bytes"], r["mtime"], r["trades"], r["note"], flag))
        print("        %s" % r["path"])
        if r["valid_json"]:
            print("        session=%s balance=%s keys=%s"
                  % (r["session_mode"], r["balance"], r["keys"]))
        print()

    print("-" * 70)
    if best:
        top = best[0]
        print("Best copy found: %s trades" % top["trades"])
        print("  %s" % top["path"])
        print("  last modified %s" % top["mtime"])
        print("\nDo NOT copy it over anything yet. Report this line first.")
    else:
        print("NO COPY ON DISK HAS ANY TRADES.")
        print("If the server is still running, its memory is the only place they exist.")
        print("Leave the process alive and capture its state over HTTP before anything else.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
