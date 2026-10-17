# Lessons (mistakes and wrong assumptions — append-only, read every session)

Format: `- YYYY-MM-DD [area]: what went wrong → what to do instead`

- <date> [setup]: Status files like *_COMPLETE.md are stale snapshots → never create new ones; use NOTES.md.
- Units before numbers: the instrument's price increment must be set per instrument.
  0.01 for gold and BTC, 0.0001 for most FX. A wrong tick size makes slippage larger
  than the stop, and then every strategy loses — including ones that should be coin flips.
- Scale before numbers: a stop narrower than a typical bar means the stop-first
  convention, not the market, decides those trades. A fair 1:1 bet measuring well under
  50% is the signature. Count and report ambiguous exits.
- An ATR fraction measured on one timeframe cannot be applied to another. 0.35 ATR on
  hourly bars is a different distance from 0.35 ATR on 15-minute bars. Convert to price.
- A pasted transcript is not current state. Check its date before acting on it.
- An inverse control that produces zero trades is not a control. A bullish-only pattern
  inverted on a long-only pass passes the check for free.
- Both directions profitable means drift, not edge.
- Starting Claude outside the project root disables CLAUDE.md, skills and hooks, and
  sends relative paths into the home folder.
- Count the configurations tried on one dataset. Past roughly ten, the best row is
  probably the luckiest row; get new evidence instead of another variant.
