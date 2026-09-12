# Claude starter kit — memory, brain, context, loop for any project

Drop-in Claude Code setup for an automated trading system (or any codebase). One command
installs, in the target project:

| Piece | What you get |
|-------|--------------|
| **Memory / brain / context** | `CLAUDE.md` (auto-loaded every session, with the owner's prime directive: always improve, always safe, never delete, zero errors), `.claude/memory/NOTES.md` (dated decisions), `.claude/memory/BACKLOG.md` (ideas) |
| **Loop** | `/improve-loop` skill: one safe, verified, committed improvement per run; combine with `/loop 30m /improve-loop` |
| **Skills** | `/safe-upgrade`, `/smart-entry` (10-rule entry checklist), `/verify`, `/brain` |
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

## Customise

- `CLAUDE.md` — fill in Commands with the real install/check/run/test commands.
- `.claude/settings.json` — adjust allow/deny; personal overrides go in
  `.claude/settings.local.json` (git-ignored).
- `scripts/claude-hooks/check-after-edit.sh` — add your linter or test command.
- Add skills as `.claude/skills/<name>/SKILL.md`.
