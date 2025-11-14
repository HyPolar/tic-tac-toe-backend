@echo off
echo ============================================================
echo    TIC-TAC-TOE SERVER - NEVER DOWN STARTUP SCRIPT
echo ============================================================
echo.

echo [1/5] Creating logs directory...
if not exist "logs" mkdir logs

echo [2/5] Installing/Updating PM2 globally...
npm install -g pm2

echo [3/5] Starting server with PM2...
call npm run pm2:start

echo [4/5] Setting up PM2 to auto-start on system boot...
call pm2 startup
call pm2 save

echo [5/5] Starting monitoring system...
echo.
echo ============================================================
echo    SERVER IS NOW RUNNING WITH MAXIMUM UPTIME PROTECTION!
echo ============================================================
echo.
echo Available commands:
echo   npm run pm2:status   - Check server status
echo   npm run pm2:logs     - View server logs
echo   npm run pm2:restart  - Restart server
echo   npm run pm2:monit    - Open monitoring dashboard
echo   npm run health       - Check server health
echo.
echo Monitor dashboard: http://localhost:4001/monitor/status
echo Health check: http://localhost:4000/health
echo.
echo The server will now automatically restart if it crashes
echo and will start automatically when the system boots!
echo.

pause
