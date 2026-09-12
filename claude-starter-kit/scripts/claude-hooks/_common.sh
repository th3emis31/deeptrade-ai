# shared helpers for hooks (sourced)
root_dir(){ git rev-parse --show-toplevel 2>/dev/null || pwd; }
tool_file(){ node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);
process.stdout.write((j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"")}catch(e){}})' 2>/dev/null \
  || python3 -c 'import sys,json
try:
  j=json.load(sys.stdin); print((j.get("tool_input") or {}).get("file_path") or (j.get("tool_input") or {}).get("path") or "", end="")
except Exception: pass' 2>/dev/null; }
py(){ command -v python3 >/dev/null 2>&1 && echo python3 || { command -v python >/dev/null 2>&1 && echo python || echo py; }; }
