@echo off
REM ==========================================================================
REM CPU Pipeline Visualizer — Windows Launcher
REM ==========================================================================
echo.
echo [ PIPELINE — 8086 Instruction Pipeline Visualizer ]
echo [ COAL Spring 2026 ]
echo.
echo Starting Bridge Server (port 3000 HTTP, 3001 WS)...
echo.

cd /d "%~dp0bridge"
start "" cmd /c "npm start"

echo Starting React UI (port 5173)...
cd /d "%~dp0ui"
start "" cmd /c "npm run dev"

echo.
echo ==========================================================================
echo  Bridge:  http://localhost:3000
echo  UI:      http://localhost:5173
echo  WS:      ws://localhost:3001
echo ==========================================================================
echo.
echo Press any key to stop all servers...
pause >nul
taskkill /f /im node.exe >nul 2>&1
echo Servers stopped.
