#!/usr/bin/env bash
# SessionStart: prove the session is wired correctly, then show memory and git state.
# Never fails — a broken check prints a warning, it does not stop the session.
set -u; . "$(dirname "$0")/_common.sh"

ROOT="$(root_dir)"
HERE="$(pwd -P)"

# ---------------------------------------------------------------------------
# 1. WORKING DIRECTORY. Starting Claude outside the project root silently
#    disables CLAUDE.md, every skill, and every hook — including the ones that
#    back up files before edits. Relative paths then resolve into the home
#    folder, which is how a stray data/ directory gets created and written to.
# ---------------------------------------------------------------------------
if [ "$HERE" != "$ROOT" ]; then
  echo "!!! WRONG DIRECTORY ---------------------------------------------------"
  echo "!!! Claude started in : $HERE"
  echo "!!! Project root is   : $ROOT"
  echo "!!! Memory, skills and hooks are NOT loaded, and relative paths will"
  echo "!!! resolve here rather than in the project. Exit and restart with:"
  echo "!!!     cd \"$ROOT\" && claude --continue"
  echo "!!! ------------------------------------------------------------------"
fi
cd "$ROOT" || exit 0

# ---------------------------------------------------------------------------
# 2. WIRING. Say plainly what is and is not loaded, rather than letting the
#    session assume its guardrails exist.
# ---------------------------------------------------------------------------
missing=""
[ -f CLAUDE.md ] || missing="$missing CLAUDE.md"
[ -d .claude/skills ] || missing="$missing .claude/skills"
[ -f .claude/settings.json ] || missing="$missing .claude/settings.json"
[ -d .claude/memory ] || missing="$missing .claude/memory"
if [ -n "$missing" ]; then
  echo "!!! MISSING WIRING:$missing  — run the kit installer before trusting this session."
else
  skills=$(ls .claude/skills 2>/dev/null | tr '\n' ' ')
  echo "=== wiring ok === root=$ROOT  skills: $skills"
fi

# ---------------------------------------------------------------------------
# 3. THE REPORTING CONTRACT. These are the rules that were learned the
#    expensive way. They are printed every session because a rule nobody reads
#    is not a rule.
# ---------------------------------------------------------------------------
cat <<'RULES'
=== before reporting ANY measured number ===
  1. Units: price increment per instrument (0.01 gold/BTC, 0.0001 most FX).
     A wrong tick size makes slippage larger than the stop and every row noise.
  2. Scale: the stop must be wider than a typical bar. When both stop and
     target sit inside one candle, the convention decides the trade, not the market.
  3. Control: run the inverse. An edge that does not beat its own inverse is drift.
  4. Sample: under 100 closed trades is "insufficient evidence", whatever the
     profit factor says.
  5. Provenance: a pasted transcript is not current state. Check its date.
  A number that has not passed 1 to 5 is not reported as a result.
RULES

[ -f .claude/memory/NOTES.md ] && { echo "=== session memory (last 40 lines) ==="; tail -n 40 .claude/memory/NOTES.md; }
[ -f .claude/memory/LESSONS.md ] && { echo "=== lessons ==="; grep -E "^- " .claude/memory/LESSONS.md | tail -n 15; }
[ -f .claude/memory/BACKLOG.md ] && { echo "=== open backlog items ==="; grep -n '^- \[ \]' .claude/memory/BACKLOG.md | head -10; }
echo "=== git ==="; git status --short --branch 2>/dev/null | head -20 || echo "(not a git repo yet — run: git init)"
exit 0
