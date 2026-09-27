---
name: verify
description: Full safety check before commit — compile/build, tests if present, deleted-code audit, secret scan. Use before every commit or when asked "is it safe".
---

# Verify

Report each step PASS or FAIL with evidence. Do not commit on any FAIL.

1. **Compile / build** — detect the stack and run the matching check:
   - Python: `python -m compileall -q .` (and `ruff check .` if ruff is installed)
   - Node: `npm run build` if a build script exists, else `node --check` on changed files
   - Otherwise: the `check` command in `CLAUDE.md`
2. **Tests, if present** — `pytest -q` when a `tests/` folder or pytest config exists;
   `npm test` when a test script exists. A failing test is never skipped or deleted.
3. **Nothing deleted** — list removed definitions and explain each (renamed/moved) or restore:
   ```bash
   git add -A && git diff --cached -U0 | grep -E '^-' | grep -vE '^---' | grep -E '^-\s*(def |class |function |const |export |[A-Z_]+\s*=)' || echo "no risky deletions"
   ```
4. **No secrets**:
   ```bash
   git add -A && git diff --cached | grep -iE 'sk-ant-|api[_-]?key\s*[:=]\s*["'"'"'][^"'"'"']{8,}|secret\s*[:=]\s*["'"'"'][^"'"'"']{8,}|bot[0-9]{6,}:|password\s*[:=]' && echo "SECRET FOUND — remove it" || echo "no secrets in diff"
   ```
5. **Starts** — run the project's `run` command **with its dry-run flag**. If the project
   has no dry-run flag, record that as a FAIL and stop. Never start the server to satisfy
   this step: in a trading project the run command is the thing that can reach a broker,
   and an unattended loop calling /verify would stand it up every iteration.
6. **Memory** — append the outcome to `.claude/memory/NOTES.md`.

Final line: `VERIFY: PASS` or `VERIFY: FAIL (<step>)`.
