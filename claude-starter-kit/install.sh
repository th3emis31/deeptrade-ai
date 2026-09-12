#!/usr/bin/env bash
# Install the Claude starter kit into a project folder. Safe to re-run; never overwrites.
#   bash install.sh /path/to/project
set -u
KIT="$(cd "$(dirname "$0")" && pwd)"; TARGET="${1:-}"
[ -d "$TARGET" ] || { echo "usage: bash install.sh /path/to/project"; exit 1; }
TARGET="$(cd "$TARGET" && pwd)"
ok(){ printf '  [OK] %s\n' "$*"; }; skip(){ printf '  [--] %s (exists, kept)\n' "$*"; }; warn(){ printf '  [!!] %s\n' "$*"; }
echo "Claude starter kit -> $TARGET"
( cd "$KIT" && find . -type f ! -name install.ps1 ! -name install.sh ! -name README.md ! -name gitignore.append ! -path "./claude-md-sections/*" ) | sed 's#^\./##' | while read -r rel; do
  dest="$TARGET/$rel"
  if [ "$rel" = "CLAUDE.md" ] && [ -f "$dest" ]; then
    if ! grep -q "Prime directive (from the owner)" "$dest"; then
      { printf '\n<!-- claude-starter-kit -->\n'; cat "$KIT/CLAUDE.md"; } >> "$dest"; ok "CLAUDE.md (kit sections appended)"
    else skip "CLAUDE.md"; fi; continue
  fi
  if [ -e "$dest" ]; then
    case "$rel" in scripts/claude-hooks/*)
      if ! cmp -s "$KIT/$rel" "$dest"; then
        bk="$TARGET/.claude/backups/kit-upgrade-$(date +%Y%m%d-%H%M%S)/$rel"; mkdir -p "$(dirname "$bk")"; cp "$dest" "$bk"
        cp "$KIT/$rel" "$dest" && ok "$rel (updated, old copy in .claude/backups)"
      else skip "$rel"; fi; continue;;
    esac
    skip "$rel"; continue
  fi
  mkdir -p "$(dirname "$dest")" && cp "$KIT/$rel" "$dest" && ok "$rel"
done
for sec in "$KIT"/claude-md-sections/*.md; do
  marker="$(grep -m1 '^## ' "$sec")"
  if ! grep -qF "$marker" "$TARGET/CLAUDE.md" 2>/dev/null; then cat "$sec" >> "$TARGET/CLAUDE.md"; ok "CLAUDE.md += ${marker#\#\# }"; fi
done
[ -f "$TARGET/.claude/memory/LESSONS.md" ] && sed -i.bak "s/<date>/$(date +%Y-%m-%d)/" "$TARGET/.claude/memory/LESSONS.md" && rm -f "$TARGET/.claude/memory/LESSONS.md.bak"
# merge new hooks into an existing settings.json (never removes anything)
SJ="$TARGET/.claude/settings.json"
if [ -f "$SJ" ] && ! grep -q dup-check.sh "$SJ"; then
  PY="$(command -v python3 || command -v python || echo py)"
  "$PY" - "$SJ" <<'PYEOF' && ok ".claude/settings.json += dup-check hook"
import json,sys
p=sys.argv[1]; s=json.load(open(p))
h=s.setdefault("hooks",{}).setdefault("PostToolUse",[])
grp=next((g for g in h if "Edit" in (g.get("matcher") or "")),None)
if grp is None: grp={"matcher":"Edit|Write|MultiEdit","hooks":[]}; h.append(grp)
grp.setdefault("hooks",[]).append({"type":"command","command":"bash scripts/claude-hooks/dup-check.sh","timeout":60})
json.dump(s,open(p,"w"),indent=2); open(p,"a").write("\n")
PYEOF
fi
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
