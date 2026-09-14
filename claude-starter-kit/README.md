# Claude starter kit — memory, brain, context, loop for any project

Drop-in Claude Code setup for an automated trading system (or any codebase). One command
installs, in the target project:

| Piece | What you get |
|-------|--------------|
| **Memory / brain / context** | `CLAUDE.md` (auto-loaded every session, with the owner's prime directive: always improve, always safe, never delete, zero errors), `.claude/memory/NOTES.md` (dated decisions), `.claude/memory/BACKLOG.md` (ideas) |
| **Loop** | `/improve-loop` skill: one safe, verified, committed improvement per run; combine with `/loop 30m /improve-loop` |
| **Skills** | `/safe-upgrade`, `/smart-entry` (10-rule entry checklist), `/verify`, `/brain`, `/dedupe`, `/backtest`, `/strategy`, `/train`, `/tv-plan` (TradingView drawing + paper trading cycle for `/loop`, needs `claude --chrome`) |
| **Guardrails** | "Mistake prevention" and "Backtesting, strategy and training rules" sections in `CLAUDE.md`; a duplicate-definition hook that reports any newly added function already defined elsewhere; `.claude/memory/LESSONS.md` (shown every session) and `BASELINE.md` (comparable metrics per backtest/model) |
| **Tools** | Hooks: backup before every edit, compile/build check after every edit (Python, Node, JSON auto-detected), memory shown at session start, uncommitted-work reminder on stop. Safe permission allow/deny list. Two subagents: `entry-reviewer`, `build-fixer`. `.mcp.json` with context7 only (docs, no credentials); add others per project with `claude mcp add` |

Nothing is ever overwritten: existing files are kept, an existing `CLAUDE.md` gets the kit's
sections appended, `.gitignore` gets missing lines only.

## Install

**Windows (PowerShell)**

```powershell
# 1. get the kit (once)
git clone -b claude/terminal-installation-35zvst https://github.com/th3emis31/deeptrade-ai.git C:\Users\<you>\deeptrade-ai-git

# 2. install into your project (the folder that contains your code)
powershell -ExecutionPolicy Bypass -File C:\Users\<you>\deeptrade-ai-git\claude-starter-kit\install.ps1 -Target "C:\Users\<you>\ml_trading_system"

# 3. start
cd "C:\Users\<you>\ml_trading_system"
claude
```

**macOS / Linux**

```bash
git clone -b claude/terminal-installation-35zvst https://github.com/th3emis31/deeptrade-ai.git ~/deeptrade-ai-git
bash ~/deeptrade-ai-git/claude-starter-kit/install.sh ~/ml_trading_system
cd ~/ml_trading_system && claude
```

Requirements: Git, Node 18+ (for Claude Code), and Python if the project is Python. The
hooks run through Git Bash on Windows, which Git for Windows installs.

## First session (do these in order)

```text
/brain fill        # Claude explores the code and fills CLAUDE.md "What this project is"
/smart-entry       # audit entries, sizing, gates, execution safety
/verify            # confirm checks pass before any change
/loop 30m /improve-loop   # optional: recurring safe upgrades
```

Approve the project hooks and MCP servers when Claude Code asks on first start, and log
in to each server with `/mcp`.

## Avoiding mistakes and duplication

- Every edit runs `dup-check.sh`: a newly added function/class whose name already exists
  elsewhere is reported back to Claude, which must consolidate instead of duplicating.
- `/dedupe` lists all existing duplicate groups (`bash scripts/claude-hooks/dup-check.sh --all`)
  and consolidates them one commit at a time without removing behaviour.
- `/strategy` → `/backtest` → `/train` is the order: a written hypothesis, a leak-free
  cost-aware backtest recorded in `BASELINE.md`, then versioned training that never
  overwrites the live model and promotes only when better than the baseline.
- Lessons from mistakes go to `.claude/memory/LESSONS.md` and are shown at session start.

## Customise

- `CLAUDE.md` — fill in Commands with the real install/check/run/test commands.
- `.claude/settings.json` — adjust allow/deny; personal overrides go in
  `.claude/settings.local.json` (git-ignored).
- `scripts/claude-hooks/check-after-edit.sh` — add your linter or test command.
- Add skills as `.claude/skills/<name>/SKILL.md`.
