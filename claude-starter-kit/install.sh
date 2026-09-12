#!/usr/bin/env bash
# Install the Claude starter kit into a project folder. Safe to re-run; never overwrites.
#   bash install.sh /path/to/project
set -u
KIT="$(cd "$(dirname "$0")" && pwd)"; TARGET="${1:-}"
[ -d "$TARGET" ] || { echo "usage: bash install.sh /path/to/project"; exit 1; }
TARGET="$(cd "$TARGET" && pwd)"
ok(){ printf '  [OK] %s\n' "$*"; }; skip(){ printf '  [--] %s (exists, kept)\n' "$*"; }; warn(){ printf '  [!!] %s\n' "$*"; }
echo "Claude starter kit -> $TARGET"
( cd "$KIT" && find . -type f ! -name install.ps1 ! -name install.sh ! -name README.md ! -name gitignore.append ) | sed 's#^\./##' | while read -r rel; do
  dest="$TARGET/$rel"
  if [ "$rel" = "CLAUDE.md" ] && [ -f "$dest" ]; then
    if ! grep -q "Prime directive (from the owner)" "$dest"; then
      { printf '\n<!-- claude-starter-kit -->\n'; cat "$KIT/CLAUDE.md"; } >> "$dest"; ok "CLAUDE.md (kit sections appended)"
    else skip "CLAUDE.md"; fi; continue
  fi
  if [ -e "$dest" ]; then skip "$rel"; continue; fi
  mkdir -p "$(dirname "$dest")" && cp "$KIT/$rel" "$dest" && ok "$rel"
done
chmod +x "$TARGET"/scripts/claude-hooks/*.sh 2>/dev/null
touch "$TARGET/.gitignore"
while read -r line; do [ -n "$line" ] && ! grep -qxF "$line" "$TARGET/.gitignore" && echo "$line" >> "$TARGET/.gitignore"; done < "$KIT/gitignore.append"
ok ".gitignore updated"; mkdir -p "$TARGET/.claude/backups"
[ -f "$TARGET/.claude/memory/NOTES.md" ] && sed -i.bak "s/<date>/$(date +%Y-%m-%d)/" "$TARGET/.claude/memory/NOTES.md" && rm -f "$TARGET/.claude/memory/NOTES.md.bak"
for t in git claude node python3; do command -v "$t" >/dev/null 2>&1 && ok "$t found" || warn "$t not found on PATH"; done
if command -v git >/dev/null 2>&1; then
  ( cd "$TARGET"; if [ ! -d .git ]; then git init -q && git add -A && git commit -q -m "Initial import + Claude starter kit" && ok "git repository created with first commit"; else ok "git repository present"; fi )
fi
echo; echo "Next:"; echo "  cd \"$TARGET\" && claude"; echo "  /brain fill"; echo "  /smart-entry"; echo "  /loop 30m /improve-loop"
