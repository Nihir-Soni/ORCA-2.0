@echo off
setlocal EnableDelayedExpansion
title ORCA - SIH26176 - Team Random

REM ===================================================================
REM  ORCA one-click launcher
REM  Double-click this file. It checks everything, starts the server
REM  and opens the app. No arguments, no setup, no internet needed.
REM ===================================================================

cd /d "%~dp0"

echo.
echo   ===============================================================
echo     ORCA - Marine EcOsystem Reasoning with Collaborative Agents
echo     Smart India Hackathon 2026  ^|  SIH26176  ^|  Team Random
echo   ===============================================================
echo.

REM ---------- 1. Python ----------
where python >nul 2>&1
if errorlevel 1 (
    echo   [X] Python was not found on this PC.
    echo.
    echo       Install Python 3.10 or newer from https://python.org
    echo       and TICK "Add python.exe to PATH" during setup.
    echo.
    pause
    exit /b 1
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo   [OK] Python !PYVER!

set PY_CMD=python
if exist ".venv\Scripts\python.exe" set PY_CMD="%~dp0.venv\Scripts\python.exe"

REM ---------- 2. Backend dependencies ----------
%PY_CMD% -c "import fastapi, uvicorn, pydantic, httpx" >nul 2>&1
if errorlevel 1 (
    echo   [..] Installing backend packages ^(one time, ~30 seconds^)...
    %PY_CMD% -m pip install --quiet --disable-pip-version-check -r backend\requirements.txt
    if errorlevel 1 (
        echo   [X] Could not install Python packages.
        echo       Try manually:  %PY_CMD% -m pip install -r backend\requirements.txt
        pause
        exit /b 1
    )
    echo   [OK] Backend packages installed
) else (
    echo   [OK] Backend packages present
)

REM ---------- 3. Frontend build ----------
if exist "frontend\dist\index.html" (
    echo   [OK] Frontend build present
) else (
    echo   [..] Frontend not built yet - building now...
    where npm >nul 2>&1
    if errorlevel 1 (
        echo   [X] npm not found and frontend\dist is missing.
        echo       Install Node.js from https://nodejs.org, then run this file again.
        pause
        exit /b 1
    )
    pushd frontend
    if not exist "node_modules" (
        echo   [..] Installing frontend packages ^(a few minutes, one time^)...
        call npm install --no-audit --no-fund
    )
    call npm run build
    popd
    if not exist "frontend\dist\index.html" (
        echo   [X] Frontend build failed.
        pause
        exit /b 1
    )
    echo   [OK] Frontend built
)

REM ---------- 4. Free the port ----------
set PORT=8000
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo   [..] Port %PORT% busy - stopping old ORCA instance ^(PID %%p^)
    taskkill /F /PID %%p >nul 2>&1
)

REM ---------- 5. Go ----------
echo.
echo   ---------------------------------------------------------------
echo     Starting ORCA on  http://127.0.0.1:%PORT%
echo.
echo     Guided tour   http://127.0.0.1:%PORT%/?tour=1
echo     API docs      http://127.0.0.1:%PORT%/docs
echo.
REM  NOTE: never start an echoed line with "/?" — cmd treats it as a request
REM  for ECHO's own help text and prints that instead. Full URLs avoid it.
echo     Demo shortcuts:
echo       http://127.0.0.1:%PORT%/?demo=safe     Goa      LOW
echo       http://127.0.0.1:%PORT%/?demo=danger   Mumbai   HIGH  ^(Kannada^)
echo       http://127.0.0.1:%PORT%/?demo=cyclone  Paradip  EXTREME
echo       http://127.0.0.1:%PORT%/?demo=pfz      Kochi    fishing zones ^(Hindi^)
echo       http://127.0.0.1:%PORT%/?demo=route    Mumbai   safest route + geofence
echo.
echo     Close this window to stop ORCA.
echo   ---------------------------------------------------------------
echo.

set PYTHONIOENCODING=utf-8
if not defined ORCA_DATA_MODE set ORCA_DATA_MODE=DEMO

start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://127.0.0.1:%PORT%/?tour=1"

cd backend
%PY_CMD% -m uvicorn app.main:app --host 127.0.0.1 --port %PORT%

echo.
echo   ORCA stopped.
pause
