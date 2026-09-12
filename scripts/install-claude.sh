#!/usr/bin/env bash
# Install Claude Code in the terminal and wire this repo's memory, skills, hooks and tools.
# Safe to re-run: it never deletes anything, only adds or updates.
#
#   bash scripts/install-claude.sh          # install + configure
#   bash scripts/install-claude.sh --check  # only report what is installed
set -u
CHECK_ONLY=0; [ "${1:-}" = "--check" ] && CHECK_ONLY=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ok(){ printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn(){ printf '  \033[33m•\033[0m %s\n' "$*"; }
fail(){ printf '  \033[31m✘\033[0m %s\n' "$*"; }

echo "DeepTrade AI — Claude Code terminal setup"
echo "repo: $ROOT"
echo

# 1. Node
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
  if [ "$NODE_MAJOR" -ge 18 ]; then ok "node $(node -v)"; else fail "node >= 18 required (found $(node -v))"; fi
else
  fail "node not found. Install Node 18+ from https://nodejs.org or via nvm, then re-run."
  [ $CHECK_ONLY -eq 1 ] || exit 1
fi

# 2. Claude Code CLI
if command -v claude >/dev/null 2>&1; then
  ok "claude $(claude --version 2>/dev/null | head -1)"
else
  if [ $CHECK_ONLY -eq 1 ]; then
    fail "claude not installed"
  else
    warn "installing Claude Code…"
    if command -v curl >/dev/null 2>&1 && curl -fsSL https://claude.ai/install.sh | bash; then
      ok "installed via native installer"
    elif npm install -g @anthropic-ai/claude-code; then
      ok "installed via npm"
    else
      fail "could not install Claude Code. See https://code.claude.com/docs/en/setup"
    fi
    hash -r 2>/dev/null
    command -v claude >/dev/null 2>&1 || warn "open a new terminal so 'claude' is on your PATH"
  fi
fi

# 3. Project dependencies
if [ -d "$ROOT/node_modules" ]; then ok "node_modules present"; else
  if [ $CHECK_ONLY -eq 1 ]; then warn "node_modules missing (npm install)"; else
    (cd "$ROOT" && npm install --no-audit --no-fund) && ok "npm install done" || fail "npm install failed"
  fi
fi

# 4. Repo-level Claude configuration (memory, skills, hooks, agents)
for f in CLAUDE.md .claude/settings.json .claude/memory/NOTES.md .claude/memory/BACKLOG.md \
         .claude/skills/safe-upgrade/SKILL.md .claude/skills/smart-entry/SKILL.md \
         .claude/skills/verify/SKILL.md .claude/skills/improve-loop/SKILL.md \
         .claude/skills/brain/SKILL.md .claude/agents/entry-reviewer.md .claude/agents/build-fixer.md; do
  [ -f "$ROOT/$f" ] && ok "$f" || fail "$f missing (re-pull the repo)"
done
chmod +x "$ROOT"/scripts/claude-hooks/*.sh 2>/dev/null && ok "hook scripts executable"
mkdir -p "$ROOT/.claude/backups" && ok ".claude/backups ready (git-ignored)"

# 5. Optional tools (only report; nothing is forced)
for t in git rg jq; do command -v $t >/dev/null 2>&1 && ok "$t available" || warn "$t not found (optional)"; done

# 6. API key hint (never written to the repo)
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then ok "ANTHROPIC_API_KEY set in this shell"; else
  warn "ANTHROPIC_API_KEY not set — 'claude' will ask you to log in on first run (that is fine)."
fi

echo
echo "Next:"
echo "  cd $ROOT && claude            # start Claude Code with this repo's memory loaded"
echo "  /brain                        # recall project memory"
echo "  /smart-entry                  # review or improve the entry system"
echo "  /loop 30m /improve-loop       # recurring safe improvements"
echo "  docs/CLAUDE_CODE_SETUP.md     # full guide"
exit 0
