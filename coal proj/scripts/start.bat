@echo off
title CPU Pipeline Visualizer
cd /d "%~dp0.."

echo ============================================
echo  8086 CPU PIPELINE VISUALIZER
echo  COAL Spring 2026
echo ============================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] Installing bridge dependencies...
cd bridge
call npm install >nul 2>&1
cd ..

echo [2/3] Building UI...
cd ui
call npm install >nul 2>&1
call npm run build >nul 2>&1
cd ..

echo [3/3] Starting bridge server...
echo.
echo  WebSocket: ws://localhost:3001
echo  HTTP:      http://localhost:3000
echo.
echo  Controls:
echo    SPACE  = Step one cycle
echo    R      = Run continuously
echo    P      = Pause
echo    Q      = Reset
echo.

cd bridge
node server.js
pause
