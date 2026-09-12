# Project memory for Claude Code (brain / context)

Loaded automatically at the start of every session in this folder. This is the long-term
memory. Keep it accurate. Session notes live in `.claude/memory/NOTES.md`, ideas in
`.claude/memory/BACKLOG.md`.

## Prime directive (from the owner)

- **Always improve, always safe.** Every change is an upgrade. Never delete features,
  files, functions, config keys, or data. Add, extend, refine.
- **Zero errors.** A change is not done until the project's check command passes
  (see Commands) and the program still starts.
- **Smart entry system first.** This is an automated trading system. Improvements must
  make entries safer and smarter: validation, risk sizing, regime/session gates,
  confidence, idempotent execution, audit logging.
- **Safe change protocol** for every edit: read → back up (automatic hook) → smallest
  possible diff → run checks → verify → commit.
- Never commit secrets (API keys, broker credentials, bot tokens, passwords). Keep them in
  `.env`, which is git-ignored.

## What this project is

<!-- Run /init once and paste its summary here, or fill in by hand. -->
- Purpose:
- Language / framework:
- Entry point (how it starts):
- Where signals / entries are generated:
- Where risk and position sizing live:
- Where orders are sent to the broker/exchange:
- Where data comes from (feeds, files, APIs):
- Where the ML model is trained and loaded:

## Commands

```bash
# Fill in the real ones. The hooks and /verify skill auto-detect common cases:
#   Node:   npm install / npm run build / npm test
#   Python: pip install -r requirements.txt / python -m py_compile <file> / pytest -q
install:
check:      # must pass before any commit
run:
test:
```

## Smart entry system — rules for improvements

1. An entry is only "smart" when it has direction, entry, stop loss, at least one take
   profit, risk:reward ≥ 1.5, an adjusted confidence, and a session/regime check.
2. Position size always comes from one sizing function; never hard-code lots or units.
3. When market conditions are rated AVOID, automation must not open new entries; it may
   still record and display signals.
4. New logic goes into pure, testable functions next to the existing helpers. Keep
   UI / IO layers thin.
5. Every new field on a signal or config is optional with a default so old data still loads.
6. Every automated decision is logged with its reasons so it can be audited.

## Claude Code workflow here

- Skills: `/safe-upgrade`, `/smart-entry`, `/verify`, `/improve-loop`, `/brain`.
- Hooks in `.claude/settings.json` back up files before edits and run checks after edits.
- Recurring improvement: `/loop 30m /improve-loop`.
- Memory: append decisions to `.claude/memory/NOTES.md`; ideas to `BACKLOG.md`.
- Work on `claude/<topic>` branches; never push to `main` directly.

## Things not to do

- Do not restructure folders in the same change as a feature.
- Do not change the broker/exchange order path without a dry-run flag and a test.
- Do not change persisted data formats without a migration.
