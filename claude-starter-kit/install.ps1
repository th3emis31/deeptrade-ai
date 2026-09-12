<#
.SYNOPSIS
  Install the Claude starter kit (memory, brain, context, loop, skills, hooks) into a project.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\install.ps1 -Target "C:\Users\me\ml_trading_system"
.NOTES
  Safe to re-run. Never overwrites an existing file; existing CLAUDE.md gets the kit's
  sections appended under a marker instead.
#>
param(
  [Parameter(Mandatory = $true)][string]$Target,
  [switch]$SkipGitInit
)
$ErrorActionPreference = "Stop"
$Kit = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path $Target)) { throw "Target folder not found: $Target" }
$Target = (Resolve-Path $Target).Path
function OK($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function SKIP($m){ Write-Host "  [--] $m (exists, kept)" -ForegroundColor Yellow }
function WARN($m){ Write-Host "  [!!] $m" -ForegroundColor Red }

Write-Host "Claude starter kit -> $Target"

# 1. Copy files without overwriting
$files = Get-ChildItem -Path $Kit -Recurse -File | Where-Object {
  $_.Name -notin @("install.ps1","install.sh","README.md","gitignore.append")
}
foreach ($f in $files) {
  $rel = $f.FullName.Substring($Kit.Length).TrimStart('\','/')
  $dest = Join-Path $Target $rel
  if ($rel -eq "CLAUDE.md" -and (Test-Path $dest)) {
    $existing = Get-Content $dest -Raw
    if ($existing -notmatch "Prime directive \(from the owner\)") {
      Add-Content -Path $dest -Value "`n<!-- claude-starter-kit -->`n" 
      Add-Content -Path $dest -Value (Get-Content $f.FullName -Raw)
      OK "CLAUDE.md (kit sections appended)"
    } else { SKIP "CLAUDE.md" }
    continue
  }
  if (Test-Path $dest) { SKIP $rel; continue }
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  Copy-Item $f.FullName $dest
  OK $rel
}

# 2. .gitignore (append missing lines)
$gi = Join-Path $Target ".gitignore"
if (-not (Test-Path $gi)) { New-Item -ItemType File -Path $gi | Out-Null }
$have = Get-Content $gi
foreach ($line in Get-Content (Join-Path $Kit "gitignore.append")) {
  if ($line -and ($have -notcontains $line)) { Add-Content -Path $gi -Value $line }
}
OK ".gitignore updated"
New-Item -ItemType Directory -Force -Path (Join-Path $Target ".claude\backups") | Out-Null

# 3. Date the first memory note
$notes = Join-Path $Target ".claude\memory\NOTES.md"
if (Test-Path $notes) { (Get-Content $notes -Raw) -replace "<date>", (Get-Date -Format "yyyy-MM-dd") | Set-Content $notes -NoNewline }

# 4. Tooling checks
foreach ($t in @("git","claude","node","python")) {
  if (Get-Command $t -ErrorAction SilentlyContinue) { OK "$t found" } else { WARN "$t not found on PATH" }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  WARN "Install Git: winget install --id Git.Git -e --source winget  (then open a new terminal)"
}
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  WARN "Install Claude Code: irm https://claude.ai/install.ps1 | iex  (then open a new terminal)"
}

# 5. git init (so backups, diffs and /verify work)
if (-not $SkipGitInit -and (Get-Command git -ErrorAction SilentlyContinue)) {
  Push-Location $Target
  if (-not (Test-Path ".git")) { git init -q; git add -A; git commit -q -m "Initial import + Claude starter kit"; OK "git repository created with first commit" }
  else { OK "git repository present" }
  Pop-Location
}

Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  cd `"$Target`""
Write-Host "  claude              # start; approve the project hooks and MCP servers when asked"
Write-Host "  /brain fill         # let Claude fill in CLAUDE.md from the real code"
Write-Host "  /smart-entry        # audit the entry system"
Write-Host "  /loop 30m /improve-loop   # recurring safe upgrades"
