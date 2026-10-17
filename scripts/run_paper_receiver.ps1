<#
.SYNOPSIS
    Starts the paper-trading webhook receiver on Windows.

.DESCRIPTION
    Finds a working Python, creates and remembers a webhook secret, points the
    ledger at the trading system's paper-trading folder when it exists, then runs
    scripts/paper_webhook_receiver.py.

    The receiver records orders only. It has no broker client and cannot place a
    live order.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\run_paper_receiver.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\run_paper_receiver.ps1 -NewSecret
#>

[CmdletBinding()]
param(
    [int]$Port = 8787,
    [string]$Ledger = "",
    [string]$PythonExe = "",
    [switch]$NewSecret,
    [switch]$ShowSecret
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$receiver = Join-Path $repoRoot "scripts\paper_webhook_receiver.py"

if (-not (Test-Path $receiver)) {
    Write-Error "Receiver not found at $receiver"
    exit 1
}

# --- 1. Find Python -------------------------------------------------------
# "python3" on Windows is usually the Microsoft Store stub, so it is never tried.
function Find-Python {
    param([string]$Preferred)

    $candidates = @()
    if ($Preferred) { $candidates += $Preferred }
    $candidates += @(
        (Join-Path $HOME "ml_trading_system\venv\Scripts\python.exe"),
        (Join-Path $HOME "ml_trading_system\.venv\Scripts\python.exe"),
        "py",
        "python"
    )

    foreach ($c in $candidates) {
        try {
            # $args is an automatic variable in PowerShell, so a different name is used.
            $verArgs = @()
            if ($c -eq "py") { $verArgs = @("-3") }
            $out = & $c @verArgs "--version" 2>&1
            if ($LASTEXITCODE -eq 0 -and "$out" -match "Python 3") {
                return [pscustomobject]@{ Exe = $c; LaunchArgs = $verArgs; Version = "$out".Trim() }
            }
        } catch {
            continue
        }
    }
    return $null
}

$py = Find-Python -Preferred $PythonExe
if ($null -eq $py) {
    Write-Host "No Python 3 found." -ForegroundColor Red
    Write-Host "Install it with:  winget install --id Python.Python.3.12"
    Write-Host "Then open a NEW terminal and run this script again."
    exit 1
}
Write-Host ("Python: {0} ({1})" -f $py.Version, $py.Exe) -ForegroundColor Green

# --- 2. Secret ------------------------------------------------------------
# Kept in the user profile, never in the repository and never in git.
$secretFile = Join-Path $HOME ".paper_webhook_secret"

if ($NewSecret -or -not (Test-Path $secretFile)) {
    $chars = (48..57) + (65..90) + (97..122)
    $secret = -join ($chars | Get-Random -Count 48 | ForEach-Object { [char]$_ })
    Set-Content -Path $secretFile -Value $secret -NoNewline -Encoding ASCII
    Write-Host "New webhook secret written to $secretFile" -ForegroundColor Yellow
} else {
    $secret = (Get-Content -Path $secretFile -Raw).Trim()
}

if ($ShowSecret) {
    Write-Host "Secret (paste into the Pine script settings): $secret" -ForegroundColor Cyan
} else {
    Write-Host "Secret loaded. Run with -ShowSecret to print it for the Pine settings."
}

# --- 3. Ledger ------------------------------------------------------------
if (-not $Ledger) {
    $systemLedgerDir = Join-Path $HOME "ml_trading_system\data\paper_trading"
    if (Test-Path $systemLedgerDir) {
        $Ledger = Join-Path $systemLedgerDir "tv_router_ledger.json"
    } else {
        $Ledger = Join-Path $repoRoot "data\paper_trading\tv_router_ledger.json"
    }
}
$ledgerDir = Split-Path -Parent $Ledger
if (-not (Test-Path $ledgerDir)) { New-Item -ItemType Directory -Path $ledgerDir -Force | Out-Null }
Write-Host "Ledger: $Ledger"

# --- 4. Run ---------------------------------------------------------------
$env:PAPER_WEBHOOK_SECRET = $secret
$env:PAPER_LEDGER = $Ledger
$env:PAPER_PORT = "$Port"

Write-Host ""
Write-Host "Receiver starting on http://127.0.0.1:$Port/webhook   (paper and demo only, dry run always on)" -ForegroundColor Green
Write-Host "Health check in another terminal:  curl.exe http://127.0.0.1:$Port/health"
Write-Host "Stop it with Ctrl+C."
Write-Host ""

$runArgs = @()
if ($py.LaunchArgs) { $runArgs += $py.LaunchArgs }
$runArgs += $receiver

& $py.Exe $runArgs
