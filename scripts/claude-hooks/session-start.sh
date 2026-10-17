#!/usr/bin/env bash
# SessionStart hook: make sure the project is ready and surface memory notes.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ ! -d node_modules ]; then
  echo "[deeptrade] node_modules missing — running npm install (one time)…" >&2
  npm install --no-audit --no-fund >/dev/null 2>&1 && echo "[deeptrade] npm install done" >&2 \
    || echo "[deeptrade] npm install failed; run it manually" >&2
fi
if [ -f .claude/memory/NOTES.md ]; then
  echo "=== DeepTrade session memory (.claude/memory/NOTES.md, last 40 lines) ==="
  tail -n 40 .claude/memory/NOTES.md
fi
echo "=== git ==="
git status --short --branch 2>/dev/null | head -20
exit 0
