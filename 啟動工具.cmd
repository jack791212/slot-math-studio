@echo off
title SLOT Math Studio
REM === SLOT Math Studio - one-click launcher ===
REM Calls node.exe and Vite by ABSOLUTE path, so it works even if PATH
REM is stale (Explorer caches env vars until you log out/in). No pnpm needed.

REM Node lives on D: inside the project (.node) so this works regardless of PATH.
set "NODEDIR=%~dp0.node"
set "STUDIO=%~dp0apps\studio"

if not exist "%NODEDIR%\node.exe" (
  echo [ERROR] Node not found at: "%NODEDIR%\node.exe"
  echo The portable Node folder ".node" is missing next to this file.
  echo.
  pause
  exit /b 1
)
if not exist "%STUDIO%\node_modules\vite\bin\vite.js" (
  echo [ERROR] Dependencies are missing.
  echo Open a terminal in this folder and run:  pnpm install
  echo.
  pause
  exit /b 1
)

echo ========================================================
echo   Starting SLOT Math Studio...
echo   A browser tab opens automatically when ready.
echo   If not, open this URL manually:  http://localhost:5173
echo.
echo   To STOP: close this window, or press Ctrl+C.
echo ========================================================
echo.

cd /d "%STUDIO%"
"%NODEDIR%\node.exe" "node_modules\vite\bin\vite.js" --open

echo.
echo Server stopped. Press any key to close.
pause >nul
