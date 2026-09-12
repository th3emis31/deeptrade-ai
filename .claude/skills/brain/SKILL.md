---
name: brain
description: Read or update the project's persistent memory (CLAUDE.md, .claude/memory/NOTES.md, BACKLOG.md). Use when the user says "remember", "what did we decide", "memory", "context", or "brain".
---

# Brain (memory / context)

Memory layers, from most to least stable:

| Layer | File | Content |
|-------|------|---------|
| Long-term | `CLAUDE.md` | Architecture, rules, commands. Auto-loaded every session. |
| Working notes | `.claude/memory/NOTES.md` | Dated log of decisions, learnings, gotchas. |
| Backlog | `.claude/memory/BACKLOG.md` | Improvement ideas with status checkboxes. |
| Backups | `.claude/backups/` | Automatic pre-edit file snapshots (git-ignored). |

## Commands
- **recall** (default when no argument): print the last 30 lines of NOTES.md and the open
  items in BACKLOG.md, then summarise the current state in 3 bullets.
- **remember <text>**: append `- YYYY-MM-DD: <text>` to NOTES.md.
- **backlog <text>**: append `- [ ] <text>` to BACKLOG.md.
- **promote <text>**: a rule that must hold for every session → add it to the relevant
  section of `CLAUDE.md` (keep CLAUDE.md under ~150 lines; move detail to docs/).

Never delete existing memory lines; strike through with `~~` if obsolete.
