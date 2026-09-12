#!/usr/bin/env bash
# Stop hook: remind about uncommitted work and a final build check. Never blocks.
set -u
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$root" || exit 0
changes="$(git status --short 2>/dev/null | grep -v '^?? .claude/backups' | wc -l | tr -d ' ')"
if [ "$changes" != "0" ]; then
  echo "[deeptrade] $changes uncommitted change(s). Run /verify then commit on a claude/* branch."
fi
exit 0
