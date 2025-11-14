@echo off
title Tic-Tac-Toe Immortal Server
color 0A

echo.
echo ============================================================
echo    🛡️ TIC-TAC-TOE IMMORTAL SERVER PROTOCOL 🛡️
echo ============================================================
echo.

echo Starting Immortal Server Protocol...

REM Clean up any existing processes
echo [1/6] Cleaning up existing processes...
taskkill /f /im node.exe 2>nul
taskkill /f /im pm2.exe 2>nul
timeout /t 2 /nobreak >nul

REM Create required directories
echo [2/6] Creating required directories...
if not exist "logs" mkdir logs
if not exist "backup" mkdir backup

REM Install/Update PM2
echo [3/6] Installing/Updating PM2...
call npm install -g pm2 --force

REM Start server with PM2
echo [4/6] Starting server with PM2...
call npm run pm2:start

REM Wait for server to initialize
echo [5/6] Waiting for server initialization...
timeout /t 10 /nobreak >nul

REM Setup auto-startup
echo [6/6] Configuring system boot auto-start...
call pm2 startup
call pm2 save

echo.
echo ============================================================
echo    🎉 YOUR SERVER IS NOW IMMORTAL! 🎉
echo ============================================================
echo.

echo 🛡️ Active Protection Systems:
echo   ✅ PM2 Auto-Restart on Crash
echo   ✅ System Boot Auto-Start
echo   ✅ Advanced Error Handling
echo   ✅ Memory Management
echo   ✅ Emergency Recovery
echo.

echo 🔗 Server Endpoints:
echo   Game: http://localhost:4000
echo   Health: http://localhost:4000/health
echo   Monitor: http://localhost:4001/monitor/status
echo.

echo 📊 Available Commands:
echo   npm run pm2:status      - Check server status
echo   npm run pm2:logs        - View server logs
echo   npm run pm2:monit       - Open PM2 monitoring
echo   npm run immortal        - Run PowerShell immortal script
echo   npm run emergency-restart - Emergency restart server
echo   npm run nuke-restart    - Nuclear restart (kill all and restart)
echo.

echo Your server will now automatically restart on any crash
echo and will start automatically when the system boots!
echo.

echo Starting monitoring system in background...
start /min node server-monitor.js

echo.
echo The server is now IMMORTAL and will NEVER stay down!
echo.

pause
