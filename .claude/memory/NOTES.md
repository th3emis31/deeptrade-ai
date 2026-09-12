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
