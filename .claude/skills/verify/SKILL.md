---
name: verify
description: Full safety check for DeepTrade AI before commit — build, diff audit for deleted code, secret scan, and a smoke render of the production bundle. Use before every commit or when asked "is it safe".
---

# Verify

Run these in order and report each as PASS or FAIL with the evidence. Do not commit if
any step fails; fix and re-run.

1. **Build**
   ```bash
   npm run build
   ```
2. **Nothing deleted** — inspect removed lines for functions, components, reducer cases,
   NAV entries, or state keys:
   ```bash
   git diff -U0 | grep -E '^-' | grep -vE '^---' | grep -E 'function |const [A-Za-z_]+ *=|case "|useState|useReducer|\{ *label:' || echo "no risky deletions"
   ```
   Any hit must be explained (renamed/moved) or restored.
3. **No secrets**
   ```bash
   git diff | grep -iE 'sk-ant-|api[_-]?key *[:=] *"[^"]{8,}|bot[0-9]{6,}:|password *[:=] *"[^"]+"' && echo "SECRET FOUND — remove it" || echo "no secrets in diff"
   ```
4. **Smoke check of the bundle** — the built HTML must reference a JS bundle and the
   bundle must contain the app entry:
   ```bash
   test -f dist/index.html && grep -q 'type="module"' dist/index.html && ls dist/assets/*.js >/dev/null && echo "bundle OK"
   ```
5. **Optional live render** (when a browser is available): `npm run preview` and load
   http://localhost:4173, confirm the login screen renders and the console has no errors.
6. **Memory** — append the outcome to `.claude/memory/NOTES.md`.

Final line of your report: `VERIFY: PASS` or `VERIFY: FAIL (<step>)`.
