@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies, this only happens once...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :err
)

if not exist data\catalogue.json (
  echo Building class catalogue...
  call npm run catalogue
  if errorlevel 1 goto :err
)

rem OneDrive locks Next's build folder and crashes the dev server, so .next lives
rem outside OneDrive and is linked in. Re-create the links if they went missing.
if not exist "%LOCALAPPDATA%\class-hub\next" mkdir "%LOCALAPPDATA%\class-hub\next"
rem A real folder here (not a link) would put the build cache back inside OneDrive.
if exist ".next" (
  fsutil reparsepoint query ".next" >nul 2>&1 || rmdir /S /Q ".next"
)
if not exist ".next" mklink /J ".next" "%LOCALAPPDATA%\class-hub\next" >nul 2>&1
if not exist "%LOCALAPPDATA%\class-hub\node_modules" mklink /J "%LOCALAPPDATA%\class-hub\node_modules" "%~dp0node_modules" >nul 2>&1

echo.
echo   Class Hub  ->  http://localhost:3000
echo   Press Ctrl+C to stop the server.
echo.
call npm run dev
goto :eof

:err
echo.
echo Something went wrong. Read the message above.
pause
