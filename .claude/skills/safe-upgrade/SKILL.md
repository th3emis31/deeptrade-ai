---
name: safe-upgrade
description: Make an additive, zero-error improvement to DeepTrade AI. Use for any feature, fix, or refactor request. Never deletes; backs up, edits minimally, builds, verifies, commits.
---

# Safe upgrade protocol

You are improving the DeepTrade AI trading dashboard. Follow every step in order.
The user's standing rule: **always improve, always safe, nothing deleted, no errors.**

## 1. Understand
- Read `CLAUDE.md` (auto-loaded) and the relevant section of `src/src/App.jsx`.
- Restate the change in one sentence and list the functions/components you will touch.
- If the request would remove a feature, page, state key, or reducer action: do not
  remove it. Keep it and add the new behaviour beside it (feature flag or new branch).

## 2. Back up
- The PreToolUse hook snapshots every edited file into `.claude/backups/<timestamp>/`.
- For large edits also run: `git stash list` is not enough; ensure `git status` is clean or
  the current work is committed before starting.

## 3. Edit minimally
- Prefer adding a new pure helper next to the existing helpers over editing UI inline.
- New signal fields: optional with defaults. New reducer actions: new `case`, never rewrite
  existing ones.
- Use theme tokens `T.*`; keep the existing code style (compact, single-file).

## 4. Build
- Run `npm run build`. The PostToolUse hook does this automatically after each edit; a
  failure is returned to you. Fix it before doing anything else.

## 5. Verify
- Run `/verify` (or its steps): build passes, no console errors in the changed component,
  no removed exports/functions compared with `git diff`.
- `git diff --stat` must show only the intended files.

## 6. Record and commit
- Append a dated line to `.claude/memory/NOTES.md`: what changed, why, anything learned.
- Commit on a `claude/*` branch with a message that starts with an imperative verb.
- Never push to `main`; never force-push.
