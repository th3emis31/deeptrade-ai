#!/usr/bin/env python3
"""Paper-trading webhook receiver for TradingView strategy alerts.

Takes the JSON payload emitted by strategies/pine/gold_router_v1.pine, validates it,
and records the order in a local ledger. It is deliberately incapable of touching a
live account: there is no broker client in this file.

Run:
    PAPER_WEBHOOK_SECRET='your-secret' python3 scripts/paper_webhook_receiver.py

Environment:
    PAPER_WEBHOOK_SECRET   required, must match the "secret" field in the payload
    PAPER_LEDGER           ledger path            (default data/paper_trading/tv_router_ledger.json)
    PAPER_PORT             listen port            (default 8787)
    PAPER_BIND             bind address           (default 127.0.0.1)
    PAPER_MAX_QTY          reject larger orders   (default 10)
    PAPER_MAX_PER_DAY      reject beyond this     (default 6)
    PAPER_ALLOWED_MODES    comma list             (default paper,demo)

Endpoints:
    POST /webhook   record an order
    GET  /health    liveness plus today's counters
    GET  /ledger    the last 50 entries
"""

import hmac
import json
import os
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SECRET = os.environ.get("PAPER_WEBHOOK_SECRET", "")
LEDGER = Path(os.environ.get("PAPER_LEDGER", "data/paper_trading/tv_router_ledger.json"))
PORT = int(os.environ.get("PAPER_PORT", "8787"))
BIND = os.environ.get("PAPER_BIND", "127.0.0.1")
MAX_QTY = float(os.environ.get("PAPER_MAX_QTY", "10"))
MAX_PER_DAY = int(os.environ.get("PAPER_MAX_PER_DAY", "6"))
ALLOWED_MODES = {m.strip() for m in os.environ.get("PAPER_ALLOWED_MODES", "paper,demo").split(",") if m.strip()}

REQUIRED = ("secret", "mode", "engine", "action", "symbol", "price", "stop", "target", "qty", "bar_time")
ACTIONS = {"buy", "sell"}
MAX_BODY = 8192

_lock = threading.Lock()


def _now():
    return datetime.now(timezone.utc)


def _load():
    if not LEDGER.exists():
        return []
    try:
        data = json.loads(LEDGER.read_text() or "[]")
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        # A corrupt ledger must not silently discard history.
        backup = LEDGER.with_suffix(".corrupt.%s.json" % _now().strftime("%Y%m%d%H%M%S"))
        LEDGER.rename(backup)
        return []


def _save(rows):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    tmp = LEDGER.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows, indent=2))
    tmp.replace(LEDGER)


def _today_rows(rows):
    today = _now().strftime("%Y-%m-%d")
    return [r for r in rows if str(r.get("received_at", "")).startswith(today)]


def validate(payload):
    """Return (ok, reason, cleaned). Every rejection reason is recorded, never guessed at."""
    missing = [k for k in REQUIRED if k not in payload]
    if missing:
        return False, "missing fields: %s" % ",".join(missing), None

    if not SECRET or not hmac.compare_digest(str(payload["secret"]), SECRET):
        return False, "bad secret", None

    mode = str(payload["mode"]).lower()
    if mode not in ALLOWED_MODES:
        return False, "mode %r is not paper or demo" % mode, None

    action = str(payload["action"]).lower()
    if action not in ACTIONS:
        return False, "unknown action %r" % action, None

    try:
        price = float(payload["price"])
        stop = float(payload["stop"])
        target = float(payload["target"])
        qty = float(payload["qty"])
    except (TypeError, ValueError):
        return False, "price, stop, target and qty must be numeric", None

    if qty <= 0 or qty > MAX_QTY:
        return False, "qty %s outside 0..%s" % (qty, MAX_QTY), None
    if price <= 0 or stop <= 0:
        return False, "price and stop must be positive", None
    if stop == price:
        return False, "stop equals entry, risk would be zero", None
    if action == "buy" and not (stop < price < target):
        return False, "buy needs stop < price < target", None
    if action == "sell" and not (target < price < stop):
        return False, "sell needs target < price < stop", None

    cleaned = {
        "mode": mode,
        "engine": str(payload["engine"])[:16],
        "action": action,
        "symbol": str(payload["symbol"])[:32],
        "tf": str(payload.get("tf", ""))[:8],
        "price": price,
        "stop": stop,
        "target": target,
        "qty": qty,
        "risk_pct": float(payload.get("risk_pct", 0) or 0),
        "bar_time": str(payload["bar_time"])[:32],
    }
    cleaned["risk_per_unit"] = round(abs(price - stop), 5)
    cleaned["reward_per_unit"] = round(abs(target - price), 5)
    cleaned["rr"] = round(cleaned["reward_per_unit"] / cleaned["risk_per_unit"], 3) if cleaned["risk_per_unit"] else 0
    return True, "", cleaned


def record(cleaned):
    with _lock:
        rows = _load()
        key = (cleaned["engine"], cleaned["action"], cleaned["bar_time"], cleaned["symbol"])
        for r in rows:
            if (r.get("engine"), r.get("action"), r.get("bar_time"), r.get("symbol")) == key:
                return "duplicate", r
        if len(_today_rows(rows)) >= MAX_PER_DAY:
            return "daily_cap", None
        cleaned["received_at"] = _now().isoformat(timespec="seconds")
        cleaned["status"] = "recorded"
        cleaned["dry_run"] = True
        rows.append(cleaned)
        _save(rows)
        return "recorded", cleaned


class Handler(BaseHTTPRequestHandler):
    server_version = "PaperWebhook/1.0"

    def _reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (_now().strftime("%H:%M:%S"), fmt % args))

    def do_GET(self):
        if self.path.startswith("/health"):
            rows = _load()
            self._reply(200, {"ok": True, "today": len(_today_rows(rows)), "total": len(rows),
                              "max_per_day": MAX_PER_DAY, "modes": sorted(ALLOWED_MODES), "dry_run": True})
        elif self.path.startswith("/ledger"):
            self._reply(200, {"entries": _load()[-50:]})
        else:
            self._reply(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if not self.path.startswith("/webhook"):
            self._reply(404, {"ok": False, "error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self._reply(400, {"ok": False, "error": "body missing or too large"})
            return
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._reply(400, {"ok": False, "error": "body is not JSON"})
            return
        if not isinstance(payload, dict):
            self._reply(400, {"ok": False, "error": "body is not a JSON object"})
            return

        ok, reason, cleaned = validate(payload)
        if not ok:
            self.log_message("REJECT %s", reason)
            self._reply(400, {"ok": False, "error": reason})
            return

        status, row = record(cleaned)
        if status == "daily_cap":
            self.log_message("REJECT daily cap of %d reached", MAX_PER_DAY)
            self._reply(429, {"ok": False, "error": "daily cap reached"})
            return
        self.log_message("%s %s %s %s qty=%s rr=%s", status.upper(), cleaned["engine"],
                         cleaned["action"], cleaned["symbol"], cleaned["qty"], cleaned["rr"])
        self._reply(200, {"ok": True, "status": status, "entry": row})


def main():
    if not SECRET:
        sys.stderr.write("PAPER_WEBHOOK_SECRET is not set. Refusing to start.\n")
        return 2
    if SECRET == "SET-ME":
        sys.stderr.write("PAPER_WEBHOOK_SECRET is still the placeholder. Refusing to start.\n")
        return 2
    srv = ThreadingHTTPServer((BIND, PORT), Handler)
    sys.stderr.write("paper webhook receiver on http://%s:%d/webhook  ledger=%s  dry_run=True\n"
                     % (BIND, PORT, LEDGER))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("stopped\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
