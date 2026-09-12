# Claude Code for DeepTrade AI — terminal install, memory, loops, skills, tools

This repo ships a ready-made Claude Code workspace. After one command, `claude` in your
terminal knows the project (memory), backs up and builds on every edit (hooks), and has
trading-specific skills, agents and a continuous-improvement loop.

## 1. Install in the terminal

```bash
git clone https://github.com/th3emis31/deeptrade-ai.git
cd deeptrade-ai
bash scripts/install-claude.sh
```

The script installs Node dependencies, installs the Claude Code CLI if it is missing
(native installer first, npm fallback), verifies every config file, and prints the next
commands. Re-run it any time; it never removes anything.

Manual alternatives:

| Platform | Command |
|----------|---------|
| macOS / Linux / WSL | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Windows PowerShell | `irm https://claude.ai/install.ps1 \| iex` |
| Any, via npm | `npm install -g @anthropic-ai/claude-code` |
| Homebrew | `brew install --cask claude-code` |

Then start it inside the repo:

```bash
cd deeptrade-ai
claude
```

First run asks you to log in (Claude.ai account or Console API key). Keys are stored by
the CLI, never in this repo.

## 2. Memory / brain / context

| What | Where | Loaded |
|------|-------|--------|
| Long-term project memory | `CLAUDE.md` | Automatically, every session |
| Working notes (decisions, learnings) | `.claude/memory/NOTES.md` | Shown by the SessionStart hook and by `/brain` |
| Improvement backlog | `.claude/memory/BACKLOG.md` | Used by `/improve-loop` |
| Your personal notes (not committed) | `CLAUDE.local.md` | Automatically, if present |
| Pre-edit backups | `.claude/backups/` | Written by the PreToolUse hook, git-ignored |

Inside Claude Code:

- `/brain` — recall memory; `/brain remember <text>` — save a note; `/brain backlog <idea>`.
- `/memory` — built-in editor for CLAUDE.md files.
- `#` prefix on a message — quick "remember this" shortcut built into Claude Code.

## 3. Skills (slash commands)

| Skill | Purpose |
|-------|---------|
| `/safe-upgrade` | The change protocol: back up → minimal additive edit → build → verify → commit. Nothing is ever deleted. |
| `/smart-entry` | Review or improve the automated smart entry system against a 10-rule checklist (structure, R:R, sizing, regime, session, market-day, confidence, correlation, idempotence). |
| `/verify` | Pre-commit safety gate: build, deleted-code audit, secret scan, bundle smoke check. |
| `/improve-loop` | One safe improvement per run from the backlog, verified and committed. |
| `/brain` | Memory recall / remember / backlog / promote. |

Skills live in `.claude/skills/<name>/SKILL.md`. Add your own by creating a new folder
with a `SKILL.md` that starts with `name:` and `description:` front matter.

## 4. Loops (recurring runs)

Claude Code's built-in `/loop` skill repeats any prompt or skill on an interval:

```text
/loop 30m /improve-loop          # one safe upgrade every 30 minutes
/loop /improve-loop              # self-paced
/loop 10m npm run build          # keep checking the build
```

Stop a loop with `/loop stop` (or Escape). Each `/improve-loop` iteration makes exactly
one additive change, runs `/verify`, commits on the current `claude/*` branch and records
the result in memory, so a long-running loop stays safe and auditable.

## 5. Tools: hooks, permissions, agents

**Hooks** (`.claude/settings.json` → `scripts/claude-hooks/`):

| Event | Script | Effect |
|-------|--------|--------|
| SessionStart | `session-start.sh` | Installs deps if missing, prints recent memory notes and git status |
| PreToolUse (Edit/Write) | `backup-before-edit.sh` | Snapshots the file into `.claude/backups/<timestamp>/` (keeps 30) |
| PostToolUse (Edit/Write) | `build-after-edit.sh` | Runs `npm run build` after source edits; a failure is fed back to Claude to fix immediately |
| Stop | `stop-check.sh` | Reminds about uncommitted changes |

**Permissions** pre-approve read-only and build/git commands so you are not prompted for
them, and deny destructive ones (`rm -rf`, force push, hard reset, reading `.env`).
Adjust with `/permissions` or edit `.claude/settings.json`; personal overrides go in
`.claude/settings.local.json` (git-ignored).

**Subagents** (`.claude/agents/`):

- `entry-reviewer` — read-only audit of the entry logic. Ask: "use the entry-reviewer
  agent to audit the signal generator".
- `build-fixer` — makes the smallest change to turn a red build green.

**MCP tools** (optional): add market-data or other servers with `claude mcp add …`; project
scope writes to `.mcp.json`. Do not commit servers that need secrets in their config.

## 6. Daily flow

```text
claude                       # in the repo
/brain                       # where were we
/smart-entry                 # review entries, apply improvements
/verify                      # safety gate
git commit … && git push -u origin claude/<topic>
```

## 7. Troubleshooting

- `claude: command not found` → open a new terminal, or add `~/.local/bin` to PATH.
- Build hook slow → it only runs after source edits and only when `node_modules` exists.
- Hook not firing → check `claude --debug` output and that `scripts/claude-hooks/*.sh`
  are executable (`bash scripts/install-claude.sh` fixes permissions).
- Want fewer prompts → run the built-in `/fewer-permission-prompts`.
