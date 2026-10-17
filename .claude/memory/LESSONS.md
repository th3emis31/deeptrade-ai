# Lessons (append-only; each line is a rule that would have prevented a real mistake)

- Units before numbers: set the price increment per instrument. 0.01 gold and BTC,
  0.0001 most FX. A wrong tick size makes slippage larger than the stop, and then every
  strategy loses, including bets that should be coin flips.
- Scale before numbers: a stop narrower than a typical bar means the engine's stop-first
  convention decides those trades, not the market. A fair 1:1 bet measuring well under
  50% is the signature. Count and report ambiguous exits.
- An ATR fraction measured on one timeframe cannot be carried to another. 0.35 ATR on
  hourly bars is a different distance from 0.35 ATR on 15-minute bars. Convert to price.
- Read the argument's units, not its name. A parameter called cost_pct that is actually a
  fraction charges a hundred times too much when read as a percentage.
- A pasted transcript is not current state. Check its date before acting on it. An 11-day-old
  paste was once treated as live and nearly caused an unnecessary recovery.
- An inverse control that produces no trades is not a control. A bullish-only pattern
  inverted on a long-only pass passes the check for free.
- Both directions profitable means drift, not edge.
- Under 100 closed trades is insufficient evidence, whatever the profit factor says.
- Count the configurations tried on one dataset. Past roughly ten, the best row is probably
  the luckiest row. Get new evidence instead of another variant.
- Starting Claude outside the project root disables CLAUDE.md, skills and hooks, and sends
  relative paths into the home folder. It is how a stray data/ directory gets written.
- A tool that cries wolf gets ignored. The first run of the secret scanner flagged
  YOUR_BOT_TOKEN and a documentation placeholder. Test a detector against known positives
  and known negatives before trusting its output.
- Verify who acted before naming a cause. A paper position blamed on automation had been
  placed by the owner.
- A number reported before the pre-flight is not a result. Units, scale, causality, control,
  provenance, in that order, every time.
- Do not ask a human for a parameter the data already contains. Tick size, timeframe and
  instrument class are now detected from the file and reported with the reason. The one
  parameter a person had to supply is the one that produced the worst result in this project.
- PowerShell 5.1 reads a file without a byte-order mark as ANSI. A UTF-8 em dash then
  becomes three characters, one of which is a curly closing quote the parser treats as a
  string delimiter, so the quotes unbalance and the error appears far away as
  "Missing closing '}' in statement block" pointing at an innocent line. Every .ps1 must be
  pure ASCII with a BOM; scripts/check-ps1.py enforces it.
- A file I could not execute is a file I did not test. install.ps1 was edited and shipped
  without running, and it failed on the owner's first attempt. When a change cannot be run
  here, say so in the same message that delivers it.
- Do not hardcode an install location. Git for Windows lives in Program Files for a system
  install and in AppData\Local\Programs for a per-user one; telling the owner the wrong path
  cost a terminal restart for nothing. Derive the path from where the tool actually is.
- Git Bash reports paths as /c/Users/... while Claude Code passes C:\Users\..., so comparing
  them never matches. Canonicalise a drive letter to the /c/ form before any path comparison,
  or the project-relative path stays absolute and backups land in a directory named "C:".
- Never police test files for duplicate definitions. Two pytest modules each defining a
  fixture called client() or app() is the normal shape of a suite, and blocking it teaches
  everyone to ignore the hook.
- A guardrail is only proven by its log. The hook log showed both of these within minutes of
  the hooks running for the first time; neither was visible from reading the code.
