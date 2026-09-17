# DeepTrade AI — session notes (append-only)

- 2026-09-12: Claude Code workspace installed: CLAUDE.md memory, .claude/settings.json
  hooks (backup before edit, build after edit), skills /safe-upgrade /smart-entry /verify
  /improve-loop /brain, installer scripts/install-claude.sh, docs/CLAUDE_CODE_SETUP.md.
- 2026-09-12: App entry is src/main.jsx → src/src/App.jsx (nested src is intentional in
  the current repo; do not move it without updating the import).
- 2026-09-12: callClaude in App.jsx reads window.__ANTHROPIC_KEY__ and calls the Messages
  API directly from the browser. Keep the key out of git.
- 2026-09-12: FIX (build): src/main.jsx imported ./App.jsx but the app lives in
  src/src/App.jsx → added additive shim src/App.jsx that re-exports it. Build was red before.
- 2026-09-12: FIX (runtime): the 30-min market-alert useEffect in App() referenced
  `candles` and `addNotif` before their useState/useNotifications declarations (temporal
  dead zone → "Cannot access before initialization", blank page). Moved the effect below
  the candles declaration; no lines removed. Verified with a headless Chromium render.
- 2026-09-12: Added inline SVG favicon in index.html to remove the 404 console error.
- 2026-09-12: Smoke-test recipe: `npm run build && npx vite preview --port 4173` then load
  the page headless and assert no pageerror/console errors (see /verify step 5).
- 2026-09-12: Added .mcp.json with context7, supabase, vercel, notion (keyless HTTP servers). Market-data servers with keys stay local-scope.
- 2026-09-12: Added claude-starter-kit/ — portable memory/hooks/skills/loop kit for any project (Python or Node), with install.ps1 and install.sh. Tested against a mock Python project.
- 2026-09-12: Kit v2: guardrails (mistake prevention, no-duplication, backtest/strategy/train rules) appended to CLAUDE.md; skills /dedupe /backtest /strategy /train; dup-check.sh PostToolUse hook (exit 2 on newly added duplicate definitions, --all for inventory); LESSONS.md + BASELINE.md memory; installers upgrade existing installs (merge hooks into settings.json, refresh hook scripts with backup).
- 2026-09-14: Kit: added /tv-plan skill (TradingView 4H plan redraw + Paper Trading management, loop-safe, paper-only guards).
- 2026-09-17: Strategy combination: added strategies/pine/gold_router_v1.pine and
  strategies/COMBINING.md. The router runs Swing Trend Pullback (21/50 EMA, HTF,
  Engine A) and Family C Mean Reversion SHORT (5M, Engine B) as one system:
  ADX regime picks the engine, daily EMA bias picks the direction, Engine A has
  priority and mutes Engine B for N bars, and both share session / news / ATR
  circuit-breaker / max-trades-per-day / daily-loss guards plus percent-of-equity
  risk sizing. Decision rule recorded: the combination is only kept if it beats the
  better single engine on profit factor AND drawdown. Gold session pullback is NOT
  combinable (same family as Engine A, correlated losses); ML model only as a veto.
