# Automated paper order placement from TradingView

## The constraint nobody tells you up front

TradingView's built-in **Paper Trading account has no API and no auto-execution**.
A Pine strategy draws its entries and exits on the chart and fills them in the
Strategy Tester only. It does not send them to the paper broker. Orders in the
paper account are placed by hand, or by something clicking the interface.

Webhook alerts, the only outbound automation TradingView offers, require a paid
plan (Essential or above) and they POST to a URL you control. They cannot post
back into TradingView's own paper account.

So "TradingView places paper orders automatically" is not a thing that exists.
What follows is what does.

## The four real options, ranked

### 1. Broker demo account through the existing MT5 bridge — recommended

TradingView is the chart, the signal comes from the router logic, and orders go
to a Vantage MT5 **demo** account through the bridge already built in the trading
system.

- Fully automatic, no clicking, no browser open.
- Real spread, real slippage, real weekend gaps. Paper fills that mean something.
- Free. No TradingView plan change.
- Already has the demo-only guards: magic number, dry-run flag, refusal to touch
  the live account.

Cost: the entry logic has to exist in Python as well as Pine. That is a feature,
not a tax. It is the only way to get signal parity between what you test and what
executes, and the Strategy Lab already expects one `predict_signal` entry point.

### 2. TradingView Essential plus a webhook receiver — best if TradingView must be the brain

Pine strategy alert fires with a JSON payload, TradingView POSTs it to your
machine, a receiver validates it and records or forwards the order.

- Keeps one source of truth: the exact Pine script you backtested.
- Needs a paid plan for webhooks, and a public URL. Use a Cloudflare Tunnel or
  similar, never an open port on the router.
- `scripts/paper_webhook_receiver.py` in this repo is that receiver, written for
  paper and demo only.

Setup:

```bash
export PAPER_WEBHOOK_SECRET='pick-a-long-random-string'
python3 scripts/paper_webhook_receiver.py
# then expose it, e.g.  cloudflared tunnel --url http://127.0.0.1:8787
```

In the Pine script settings set the same secret, then create an alert on the
strategy with **Webhook URL** pointing at `https://<your-tunnel>/webhook` and the
message left as `{{strategy.order.alert_message}}`.

What the receiver refuses: a wrong secret, any mode that is not paper or demo, a
stop on the wrong side of the entry, zero risk, an oversized quantity, a repeat of
a bar it already recorded, and anything past the daily cap. Everything it accepts
is written to a JSON ledger with `dry_run: true`. There is no broker client in the
file, so it cannot place a live order even if someone asks it to.

### 3. Claude in Chrome clicking the TradingView paper panel — what you have now

Works without a plan upgrade, and it is the only way to drive TradingView's own
paper account. It is also the weakest: entries land whenever the browser session
runs rather than when the bar closes, the fills are whatever the panel gives, and
any interface change breaks it silently. Keep it for redrawing the plan and
reviewing, not for measuring an edge.

### 4. Alpaca paper API

Genuinely automatic and free, but Alpaca has no spot gold. Useful for stocks and
crypto, useless for XAUUSD.

## Recommendation

Run option 1 for measurement and option 3 for review. Move to option 2 only when
you want the Pine script itself to be the system of record, and only after the
three-run test in `strategies/COMBINING.md` says the router is worth running.

Whatever the path: paper for at least twenty trades before any money question is
asked, and the ledger, not memory, is what gets compared against the backtest.

## Safety rules that do not bend

- The receiver only ever records. Adding a broker client to it turns a safe file
  into a live trading system, so that belongs in the trading system's execution
  module where the demo-account checks already live.
- The shared secret goes in the Pine script's settings and the shell environment,
  never in a saved script, never in git.
- A webhook URL is a public endpoint. Without the secret check, anyone who learns
  the URL can place orders in your ledger.

Sources: [TradingView webhook alert configuration](https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/), [TradingView alerts introduction](https://www.tradingview.com/support/solutions/43000520149-introduction-to-tradingview-alerts/)
