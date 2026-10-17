#!/usr/bin/env bash
# PreToolUse hook (Edit|Write|MultiEdit): snapshot the target file before it changes.
# Reads the tool input JSON on stdin; never blocks the edit (always exits 0).
set -u
input="$(cat)"
file="$(printf '%s' "$input" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{const j=JSON.parse(s);const p=(j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"";process.stdout.write(p)}catch(e){}
})' 2>/dev/null)"
[ -z "$file" ] && exit 0
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
case "$file" in
  "$root"/*) rel="${file#$root/}" ;;
  *) rel="$file" ;;
esac
[ -f "$file" ] || exit 0
stamp="$(date +%Y%m%d-%H%M%S)"
dest="$root/.claude/backups/$stamp/$rel"
mkdir -p "$(dirname "$dest")" && cp "$file" "$dest" 2>/dev/null
# keep only the 30 newest snapshots
ls -1dt "$root"/.claude/backups/*/ 2>/dev/null | tail -n +31 | xargs -r rm -rf
exit 0
