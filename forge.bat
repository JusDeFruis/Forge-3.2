@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 goto :node_missing

for /f "delims=v." %%a in ('node -v') do set "NODE_MAJOR=%%a"
if %NODE_MAJOR% LSS 20 goto :node_old

if /I "%~1"=="--setup-only" goto :setup

pushd "%ROOT%"

if not exist "%ROOT%node_modules" (
    echo [FORGE 3.2] Installing Node dependencies...
    call npm install --no-fund --no-audit
    if errorlevel 1 goto :install_failed
)

echo [FORGE 3.2] Building...
call npm run build
if errorlevel 1 goto :build_failed

call node "%ROOT%dist\main.js" %*
set "CODE=%ERRORLEVEL%"
popd
exit /b %CODE%

:setup
pushd "%ROOT%"
call npm install --no-fund --no-audit
if errorlevel 1 goto :install_failed
call npm run build
set "CODE=%ERRORLEVEL%"
popd
if not "%CODE%"=="0" exit /b %CODE%
echo FORGE 3.2 setup verified
exit /b 0

:node_missing
echo [FORGE 3.2] Node.js was not found.
echo [FORGE 3.2] Install Node.js 20 or newer from https://nodejs.org/ and rerun forge.bat.
exit /b 1

:node_old
echo [FORGE 3.2] Node.js 20 or newer is required. Found: %NODE_MAJOR%
echo [FORGE 3.2] Install a newer Node.js from https://nodejs.org/ and rerun forge.bat.
exit /b 1

:install_failed
echo [FORGE 3.2] npm install failed. Check the connection and rerun forge.bat.
exit /b 1

:build_failed
echo [FORGE 3.2] The TypeScript build failed. Fix the reported errors and rerun forge.bat.
exit /b 1
