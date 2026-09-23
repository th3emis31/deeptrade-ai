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
- 2026-09-17: TradingView execution research: TradingView's own Paper Trading has NO API
  and Pine strategies never auto-execute into it; webhook alerts need the Essential plan
  and POST outward only. Ranked path recorded in docs/TRADINGVIEW_AUTOMATION.md:
  (1) Vantage MT5 demo via the existing bridge = best automated paper fills,
  (2) Essential + webhook -> scripts/paper_webhook_receiver.py (stdlib http.server,
  secret check, paper/demo modes only, stop-side geometry check, qty cap, per-bar dedupe,
  daily cap, JSON ledger, dry_run always true, no broker client in the file),
  (3) Claude in Chrome clicking the paper panel = review only, (4) Alpaca has no gold.
  gold_router_v1.pine now emits a JSON alert() payload per entry for path 2.
- 2026-09-17: Windows note: bash syntax (export, python3, ./script.sh) fails in cmd.exe.
  On this machine use PowerShell, `py -3` or `python` (python3 is the Microsoft Store stub),
  and $env:VAR instead of export. Added scripts/run_paper_receiver.ps1 which finds Python
  (venv first, then py -3, then python), generates and remembers a 48-char secret in
  %USERPROFILE%\.paper_webhook_secret (never in git), points the ledger at
  ml_trading_system\data\paper_trading when present, and starts the receiver.
  This cloud session cannot run anything on the Windows PC; the local Claude Code terminal
  session is what executes these steps.
- 2026-09-17: CORRECTION — no incident. The TradingView paper position (1 @ 4280.43) and the
  Sell Stop were placed by the owner, not by automation. My first diagnosis blamed the
  /tv-plan cycle and was wrong; do not repeat it. Lesson: when a position appears
  unexplained, ask who placed it and check the paper order history timestamp against the
  schedule BEFORE naming a cause.
  KEPT ANYWAY (not a fix, a default): /tv-plan is now DRAW-ONLY by default. It reads the plan, redraws the chart and
  reports the order it WOULD place; it opens the Trading Panel only when the invocation says
  "place" explicitly. Unattended loops therefore never create positions. The webhook log line
  now carries mode: draw_only or placed.
- 2026-09-17: SECRET ROTATION: the 48-char webhook secret generated on the Windows PC was
  pasted into a chat transcript, so it is burned. Rotate with
  run_paper_receiver.ps1 -NewSecret and update the Pine script settings. Risk was low
  (receiver binds 127.0.0.1, records only) but a pasted secret is never reused.
- 2026-09-17: Added .claude/memory/BASELINE.md (from the kit) and recorded the three
  TradingView tester rows. Volatility Trend Breakout (Gold), 2023-01-02 → 2026-09-17:
  152 trades, 69.08% wins, PF 1.855, max DD 6.64%, +36.70% on 10K. Best candidate so far,
  clearly ahead of Swing Trend Pullback v2 (PF 1.64, +5.07%) on return over drawdown
  (5.5 vs 2.4). Derived from PF and win rate: avg win / avg loss = 0.83, so the payoff is
  many small wins against fewer larger losses — check the worst single loss before trusting it.
  Still unverified: broker costs, position sizing, request.security repaint, inverse baseline,
  and any period outside the 2023-2026 gold bull run.
- 2026-09-17: Volatility Trend Breakout "Better Exits" (Gold), 2023-01-02 → 2026-09-17:
  178 trades, 74.16% wins, PF 1.938, max DD 5.50%, +40.69% on 10K. Better than the previous
  version on profit, drawdown, win rate, PF and trade count simultaneously.
  Derived numbers: avg win $63.69 vs avg loss $94.30 (payoff 0.675), expectancy +0.24
  avg-loss units per trade, and max DD equals exactly 6 average losses. That last number is
  the weak point: at the observed 26% loss rate a six-loss run is expected 0.05 times in 178
  trades, but at a 40% loss rate it is expected 0.71 times, so the drawdown estimate depends
  on the win rate holding. RISK TO CHECK: tighter take-profits mean more bars where both the
  stop and the target sit inside the same bar, and without Bar Magnifier (paid plans only)
  TradingView assumes the intrabar order. The better the exits look, the more this matters.
- 2026-09-17: Added strategies/PORTING_TO_SYSTEM.md — the path for taking a TradingView
  strategy into ml_trading_system: audit the Pine source first (repaint, costs, sizing,
  intrabar exits, fitted thresholds), port into one pure function behind predict_signal,
  reproduce the TradingView trade count, pass the Strategy Lab gates (100+ OOS trades,
  PF > 1.3 after costs, inverse baseline worse, deflated Sharpe >= 0.95, leak-free
  walk-forward, one run outside 2023-2026), then demo forward test on the Vantage MT5 demo
  for 20+ trades and compare win rate against the backtest. Decision: if the breakout
  clears the gates it REPLACES the 21/50 pullback as the router's trend engine, with the
  pullback kept behind its own toggle. Family C stays the range engine.
- 2026-09-17: AUDIT of Volatility Trend Breakout (Better Exits), Pine v5 source read.
  PASSES: no request.security anywhere so no repaint; commission 0.04%/side and slippage 2
  are set, so +40.69% is already after costs; sizing is genuine risk sizing (explicit qty
  from 0.85% equity / stop distance, overriding the percent_of_equity header); entry uses
  close > upper[1] + 0.35 ATR, closed-bar only.
  FINDING 1 (material): TP1 used strategy.close, a MARKET order, and with
  process_orders_on_close=true it fills at the BAR'S CLOSE rather than at tp1Price.
  Breakout bars that reach TP1 tend to close near their high, so modelled fills beat live
  ones. Part of the 74% win rate may be this.
  FINDING 2: no margin_long, so the tester allowed unlimited leverage; risk sizing in a
  low-ATR stretch asks for 2-5x equity.
  FINDING 3: long only inside the 2023-2026 gold bull run, untested elsewhere.
  FINDING 4: the volume filter uses broker tick volume, so it will not reproduce in Python.
  Wrote strategies/AUDIT_volatility_trend_breakout.md and
  strategies/pine/volatility_trend_breakout_v2.pine (TP1 as a real limit order, leverage
  cap, optional session filter — all toggleable, v1 behaviour fully reproducible, nothing
  removed). Test order: limit TP1, then leverage cap, then 2013-2018, then BTCUSD.
- 2026-09-17: Added docs/RUN_SYSTEM_BACKTEST.md — the paste-ready prompt for the local
  session to run ml_trading_system's OWN backtest (existing entrypoint only, costs on,
  OOS only, inverse baseline, append to BASELINE.md, no model writes, no tuning on test).
  Point of the run: establish today's system baseline, which is the number the TradingView
  breakout has to beat before porting is worth the work.
- 2026-09-17: REPLICATION. Ported the Pine breakout to Python
  (strategies/python/volatility_trend_breakout.py, stdlib only, Pine-exact ta.ema/ta.rma/
  ta.rsi and the Pine broker emulator incl. stop-before-target and both TP1 fill models)
  and ran it on Twelve Data XAU/USD, an independent feed. 4H 2023-01 → 2026-09:
  213 legs / 136 positions, 72.30% wins, PF 1.750, +38.76%, max DD 5.26% — against
  TradingView's 178 legs, 74.16%, PF 1.938, +40.69%, DD 5.50%. Two feeds, two engines,
  same answer, so the result is not a TradingView artefact.
  Inverse baseline: PF 0.571, −40.94%, DD 45.22%, longest losing streak 12 legs vs 4. Fails
  hard, which is the pass condition.
  My audit Finding 1 (TP1 filled at bar close) was measured and is IMMATERIAL: PF 1.926
  limit vs 1.952 close. Recorded as a correction in the audit file.
  Regime test, daily 2011-2019: PF 0.864, −3.72% over nine years, 58 legs. Outside an
  uptrend it bleeds slowly rather than collapsing. Under 100 legs = insufficient evidence,
  and daily bars are not the 4H strategy.
  Engine was validated on a random walk first: PF ~0.96-1.0 and a small loss, i.e. no
  accidental lookahead. Also fixed the R-multiple metric to normalise by the POSITION's
  initial risk, since per-leg R overstated partial exits.
  STILL NOT CLEARED: walk-forward with fixed folds, deflated Sharpe, a 4H bear-regime run,
  the volume filter (Twelve Data has no volume for spot gold), live spread around releases.
- 2026-09-17: Audit finding 2 also measured and immaterial: across 136 positions the 5x
  leverage cap was never reached (zero capped entries) because gold's ATR stays wide enough.
  Keep the cap as a forward guard, but it changes no historical row. Exact v1 parity run
  (TP1 at bar close, no cap): 213 legs, 71.83% wins, PF 1.763, +39.65%, DD 6.34% — within
  1% of the v2 configuration. Raising risk 0.85% → 1.0% scales the result linearly
  (+47.85%, DD 7.91%), confirming the sizing path is correct.
- 2026-09-17: VERDICT on the breakout. The local 19-year Vantage run (PF 0.990 for
  2007-2022 vs 1.986 for 2023-2026) looked like overfitting. It is not. Daily XAU/USD
  2004-2012, covering the 2008-2011 bull and never tuned on, reproduces the fingerprint:
  104 legs, 73.08% wins, PF 1.888, +22.77%, DD 3.19% of peak, inverse PF 0.559.
  A curve-fitted rule set does not reproduce itself in another decade's bull market.
  Conclusion: TREND-DEPENDENT, not curve-fitted. It earns in gold uptrends and pays fees
  otherwise, which is the honest shape of a long-only breakout.
  Regime gate experiments (added to the port as --regime-filter / --regime-daily, both OFF
  by default so the Pine defaults stay intact): on daily 2004-2019 the chart gate
  (EMA200 + ADX>=20) gives the same net for half the drawdown (PF 1.376 -> 1.556,
  DD 10.78% -> 5.33%) and turns the bad years from -3.72% into -0.65%. On 4H 2023-2026 it
  COSTS profit (+16.53% vs +38.76%); the daily gate is better there (PF 1.766, +22.03%) but
  still removes 43% of trades. SELECTION BIAS WARNING recorded in the results file: three
  gate configs were tried on data already seen, so none of this is validated until the
  walk-forward runs with gate parameters fixed before each fold.
  Also fixed: max drawdown percent is now measured against peak equity, not starting
  capital, which was a fair criticism from the local run.
- 2026-09-17: OWNER DECISION: trend dependence is accepted. The strategy is to be run in
  the gold uptrend rather than filtered for all regimes, and the justification holds —
  when the trend is absent the measured cost is -3.72% over nine years, or -0.65% with the
  gate, so being wrong about the regime is cheap. Wrote strategies/DEPLOY_gold_breakout.md:
  settings table, a concrete trend-off rule (daily close below EMA200 for three consecutive
  days -> switch the regime gate ON rather than stop), expected-performance envelope for
  drift detection (win rate 70-74%, PF 1.75-1.95, payoff 0.68, streak 3-4, DD 3-6%), four
  kill switches, and the order of operations: demo forward test first, walk-forward in
  parallel, compare after 20 trades.
- 2026-09-17: FVG and CRT measured on the same engine, data and costs as the breakout.
  BOTH ARE PROFITABLE and both inverses fail hard, so neither is noise.
  4H 2023-2026: FVG PF 1.225 (+12.12%), CRT PF 1.218 (+7.53%), breakout PF 1.750 (+38.76%).
  DAILY 2004-2019 (bull + bear + chop): FVG PF 1.390 (+27.22%, DD 9.81%, 227 legs) BEATS
  the breakout (PF 1.376, +15.75%, DD 10.78%, 147 legs); CRT PF 1.207 (+12.67%).
  KEY FINDING: the breakout only earns in uptrends, FVG earned across all three regimes.
  That argues for running them together — FVG as the all-weather base, the breakout as the
  trend accelerator — rather than choosing one. Contradicts my earlier assumption that the
  breakout should simply be the primary strategy.
  Process note: my first FVG implementation returned zero trades because a zone was dropped
  on the bar that created it. Bug found and fixed before the numbers above were produced.
- 2026-09-17: PORTFOLIO TEST (strategies/python/portfolio_backtest.py, one account, one
  position, earliest signal wins). DAILY 2004-2019: Breakout+FVG = PF 1.393, +32.36%,
  DD 8.98% — beats FVG alone (1.390, +27.22%, 9.81%) and breakout alone (1.376, +15.75%,
  10.78%) on profit AND drawdown together. Adding CRT dilutes it (1.276, +26.70%, 10.62%).
  4H 2023-2026 (strong trend): breakout ALONE wins (1.750, +38.76%, DD 5.06%); adding FVG
  drops it to 1.317/+24.99%, adding CRT to 1.138/+1.23%.
  DECISION: the pair is Breakout + FVG. CRT is not additive and comes out of the portfolio.
  In a confirmed strong trend, run the breakout alone — that is the regime switch in
  DEPLOY_gold_breakout.md doing its job.
  STOP RULE RECORDED: this is about the twentieth configuration measured on the same gold
  history. Further variants on this data raise selection bias without adding information.
  The only next steps that add information are walk-forward with fixed folds, a different
  instrument, and live demo fills.
- 2026-09-17: OUT-OF-SAMPLE INSTRUMENTS. BTCUSD 4H (Jun 2024 - Sep 2026), never involved in
  building anything: FVG alone PF 1.303, +15.80%, DD 5.19%, 195 legs — it CARRIES to another
  asset class. Breakout alone PF 0.975 (-2.52%), consistent with needing a trend; CRT 0.962.
  EURUSD daily 2004-2019: FVG 1.093, breakout 1.051, CRT 0.904 — no meaningful edge on a
  major FX pair, and 1.09 would not survive a wider spread.
  BUG CAUGHT: the first EURUSD run showed PF ~0.02 and -80%. Cause was mintick defaulting to
  0.01, right for gold and BTC, catastrophic for a 1.20 instrument: 2 ticks = 0.02 slippage,
  larger than the whole 1.5 ATR stop. portfolio_backtest.py now WARNS when slippage exceeds
  10% of a typical stop distance. Always set --mintick per instrument (0.0001 for FX).
  SCOREBOARD (profit factor): FVG is positive on gold daily 1.390, gold 4H 1.225,
  BTC 4H 1.303, EURUSD 1.093 — the most robust thing measured here. The breakout beats it
  only in a gold uptrend (1.750) and trails elsewhere.
- 2026-09-23: INCIDENT (live): the project's own data/auto_trader_state.json reports
  trades: 0 with keys [session, trades, settings, jarvis], while the running Flask process
  reports 129 trades. A second, also empty, state file exists at C:\Users\th_em\data\ —
  created when the app was started from the wrong working directory. Restarting the server
  while disk holds 0 trades would destroy the history, so the process must stay alive until
  a copy with 129 trades is located or its memory is captured over HTTP.
  Added scripts/inspect_trader_state.py — READ ONLY scanner that walks the user folder and
  every zip, reports bytes / mtime / valid JSON / trade count / session mode / balance for
  each copy, flags corrupt and truncated files, and names the best copy. Tested against a
  fixture with a good backup, an emptied live file and a truncated file.
  Note for later: `cd $HOME\...` is PowerShell syntax and fails in cmd.exe, where it is
  %USERPROFILE%. The user has been running cmd, which is how the earlier command read the
  wrong file.
