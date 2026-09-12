# DeepTrade AI — Claude Code Memory (brain / context)

This file is loaded automatically by Claude Code at the start of every session in this
repository. It is the project's long-term memory. Keep it accurate; update it when the
system changes. Session notes live in `.claude/memory/`.

## Prime directive (from the owner)

- **Always improve, always safe.** Every change is an upgrade: never delete features,
  files, pages, reducers, or state keys. Add, extend, refine.
- **Zero errors.** A change is not done until `npm run build` passes and the app renders.
- **Smart entry system first.** The core product is an automated, executive-grade
  smart entry system for trading signals (entry / SL / TP1-3, risk sizing, regime and
  session awareness). Improvements should make entries safer and smarter, not louder.
- **Safe change protocol** for every edit: read → back up the touched file into
  `.claude/backups/` → smallest possible diff → build → verify → commit.
- Never commit secrets (API keys, Telegram bot tokens, passwords).

## What this project is

Single-page React 18 dashboard built with Vite. All app logic lives in one file:

| Path | Role |
|------|------|
| `index.html` | Vite entry, mounts `#root` |
| `src/main.jsx` | Renders `<App />` in StrictMode |
| `src/App.jsx` | Re-export shim → `src/src/App.jsx` (keeps the import path working; do not remove) |
| `src/src/App.jsx` | The whole app (~2,800 lines): data model, ML brain, pages, API helpers |
| `vite.config.js` | Vite + React plugin |
| `package.json` | scripts: `dev`, `build`, `preview`, `claude:install`, `claude:check` |
| `.mcp.json` | Project MCP servers (context7, supabase, vercel, notion); keyless only |
| `claude-starter-kit/` | Portable kit to install the same memory/hooks/skills/loop into any other project |

Dependencies: react, react-dom, recharts, lucide-react. Dev: vite, @vitejs/plugin-react.
No test runner, no linter, no TypeScript. The build is the safety net.

## Domain model (src/src/App.jsx)

- **Assets**: `ASSETS = XAUUSD, BTCUSD, SP500, MSFT, AMZN` with `BASE_PRICES`, `ASSET_VOL`,
  `ASSET_NAME`. Timeframes `TFS = 1m…1D`. Trading `SESSIONS` (Asia/London/NY).
- **Account** (`accountReducer`, `ACCOUNT_INITIAL`): balance, risk %, trades, alerts, P&L.
  `calcPositionSize(pair, balance, riskPercent, slPips)` is the risk engine.
- **ML brain** (`mlReducer`, `INITIAL_ML`, `ML_VERSION = "v5.0"`): per-session and per-regime
  win rates, `detectRegime(candles)`, `detectCorrelation(candles)`,
  `mlConfidenceAdjust(signal, mlState)`, `rateMarketDay(candles, mlState)` → GOOD / CAUTION / AVOID.
- **Indicators**: `genCandles`, `calcEMA`, `calcRSI`. Charts are hand-drawn SVG in
  `CandlestickChart` plus recharts on analytics pages.
- **Signals**: objects with `pair, dir, entry, sl, tp1, tp2, tp3, grade, conf, rr, status`
  and parsed numeric twins (`entryNum, slNum, tp1Num …`). `calcProfit` converts distance
  to money per lot. `formatTelegramSignal` + `sendTelegram` broadcast signals.
- **AI**: `callClaude(messages, sys, max_tokens)` calls the Anthropic Messages API directly
  from the browser using `window.__ANTHROPIC_KEY__`. Used for signal generation, daily
  plan, briefings, advice, journal entries, chat.
- **Pages** (`NAV` + `Sidebar`): Overview, Charts, Signals, News, Analysis, Performance,
  PnL Tracker, Best Times, Daily Plan, AI Chat, Training, AI Advisor, ML Brain.
- **Automation in `App()`**: 30-minute market-condition alert loop, auto-train, auto-analysis,
  push notifications, signal popup, Telegram.

## Smart entry system — rules for improvements

1. An entry is only "smart" when it has: direction, entry, SL, at least TP1, R:R ≥ 1.5,
   confidence adjusted by `mlConfidenceAdjust`, and a session/regime check.
2. Position size always comes from `calcPositionSize`; never hard-code lots.
3. When `rateMarketDay` returns AVOID, automation must not open new entries; it may
   still record and display signals.
4. New logic goes in pure helper functions near the existing helpers (top of App.jsx) so
   it can be reasoned about without the UI. Keep components thin.
5. Every new field on a signal must be optional and have a default so old signals still render.
6. Use `T` (theme tokens) for colours; never inline hex colours in JSX.

## Commands

```bash
npm install        # first time
npm run dev        # local dev server (http://localhost:5173)
npm run build      # MUST pass before any commit
npm run preview    # serve the production build
```

## Claude Code workflow in this repo

- Skills (type `/name` in the terminal): `/safe-upgrade`, `/smart-entry`, `/verify`,
  `/improve-loop`, `/brain`. See `.claude/skills/*/SKILL.md`.
- Hooks in `.claude/settings.json` back up files before edits and run the build after edits.
- Session memory: append decisions and learnings to `.claude/memory/NOTES.md`.
- Terminal install and tools: `docs/CLAUDE_CODE_SETUP.md`, `scripts/install-claude.sh`.
- Branch convention: work on `claude/<topic>` branches, never push to `main` directly.

## Things not to do

- Do not split App.jsx into many files in the same change as a feature; do it as its own
  reviewed, build-verified step if ever.
- Do not remove the `anthropic-dangerous-direct-browser-access` header without adding a
  server-side proxy first (the app depends on it).
- Do not change `ML_VERSION` semantics without a migration path for persisted ML state.
