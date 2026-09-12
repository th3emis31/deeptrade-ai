#!/usr/bin/env bash
# PostToolUse hook (Edit|Write|MultiEdit): run the Vite build after source edits.
# Exit 2 feeds the build error back to Claude so it fixes it before moving on.
set -u
input="$(cat)"
file="$(printf '%s' "$input" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{const j=JSON.parse(s);const p=(j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"";process.stdout.write(p)}catch(e){}
})' 2>/dev/null)"
case "$file" in
  *.jsx|*.js|*.ts|*.tsx|*.css|*.html|*/vite.config.js|*/package.json) ;;
  *) exit 0 ;;
esac
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$root" || exit 0
[ -d node_modules ] || exit 0
out="$(npm run build --silent 2>&1)"
status=$?
if [ $status -ne 0 ]; then
  echo "BUILD FAILED after editing $file — fix before continuing:" >&2
  echo "$out" | tail -n 40 >&2
  exit 2
fi
echo "[deeptrade] build OK after editing ${file##*/}"
exit 0
