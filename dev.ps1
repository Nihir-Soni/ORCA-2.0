# Development mode — backend with hot reload + Vite dev server (HMR).
#
#   .\dev.ps1
#
# Backend : http://127.0.0.1:8000   (API only)
# Frontend: http://127.0.0.1:5173   (open this one; it proxies /api)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$env:PYTHONIOENCODING = "utf-8"
if (-not $env:ORCA_DATA_MODE) { $env:ORCA_DATA_MODE = "DEMO" }

$py = "python"
if (Test-Path "$root\.venv\Scripts\python.exe") {
    $py = "$root\.venv\Scripts\python.exe"
}

Write-Host "Starting ORCA backend (reload) on :8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\backend'; `$env:PYTHONIOENCODING='utf-8'; `$env:ORCA_DATA_MODE='$env:ORCA_DATA_MODE'; & '$py' -m uvicorn app.main:app --reload --port 8000"
)

Start-Sleep -Seconds 2
Write-Host "Starting Vite dev server on :5173 ..." -ForegroundColor Cyan
Set-Location "$root\frontend"
if (-not (Test-Path "node_modules")) { npm install --no-audit --no-fund }
npm run dev
