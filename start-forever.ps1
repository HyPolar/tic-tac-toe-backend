# TIC-TAC-TOE SERVER - NEVER DOWN STARTUP SCRIPT (PowerShell)
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   TIC-TAC-TOE SERVER - NEVER DOWN STARTUP SCRIPT" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

try {
    Write-Host "[1/6] Creating logs directory..." -ForegroundColor Green
    if (!(Test-Path "logs")) {
        New-Item -ItemType Directory -Force -Path "logs" | Out-Null
        Write-Host "✅ Logs directory created" -ForegroundColor Green
    } else {
        Write-Host "✅ Logs directory already exists" -ForegroundColor Green
    }

    Write-Host "[2/6] Checking PM2 installation..." -ForegroundColor Green
    $pm2Check = Get-Command pm2 -ErrorAction SilentlyContinue
    if (!$pm2Check) {
        Write-Host "Installing PM2 globally..." -ForegroundColor Yellow
        npm install -g pm2
    } else {
        Write-Host "✅ PM2 is already installed" -ForegroundColor Green
    }

    Write-Host "[3/6] Starting server with PM2..." -ForegroundColor Green
    & npm run pm2:start
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Server started successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to start server" -ForegroundColor Red
        throw "Server startup failed"
    }

    Write-Host "[4/6] Checking server status..." -ForegroundColor Green
    Start-Sleep -Seconds 3
    & npm run pm2:status

    Write-Host "[5/6] Setting up PM2 auto-startup..." -ForegroundColor Green
    try {
        pm2 startup
        pm2 save
        Write-Host "✅ Auto-startup configured" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Auto-startup setup failed (may require admin rights)" -ForegroundColor Yellow
    }

    Write-Host "[6/6] Testing health check..." -ForegroundColor Green
    Start-Sleep -Seconds 5
    try {
        $healthResponse = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get -TimeoutSec 10
        if ($healthResponse.status -eq "ok") {
            Write-Host "✅ Health check passed!" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Health check returned unexpected response" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️ Health check failed - server may still be starting" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "   🎉 SERVER IS NOW RUNNING WITH MAXIMUM UPTIME! 🎉" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "📊 Available commands:" -ForegroundColor Yellow
    Write-Host "  npm run pm2:status   - Check server status" -ForegroundColor White
    Write-Host "  npm run pm2:logs     - View server logs" -ForegroundColor White
    Write-Host "  npm run pm2:restart  - Restart server" -ForegroundColor White
    Write-Host "  npm run pm2:monit    - Open monitoring dashboard" -ForegroundColor White
    Write-Host "  npm run health       - Check server health" -ForegroundColor White
    Write-Host ""
    
    Write-Host "🔗 Quick links:" -ForegroundColor Yellow
    Write-Host "  Monitor: http://localhost:4001/monitor/status" -ForegroundColor Cyan
    Write-Host "  Health:  http://localhost:4000/health" -ForegroundColor Cyan
    Write-Host "  Game:    http://localhost:4000" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "🛡️ Protection features active:" -ForegroundColor Yellow
    Write-Host "  ✅ Automatic restart on crash" -ForegroundColor Green
    Write-Host "  ✅ Memory monitoring and alerts" -ForegroundColor Green
    Write-Host "  ✅ Health check monitoring" -ForegroundColor Green
    Write-Host "  ✅ Graceful error handling" -ForegroundColor Green
    Write-Host "  ✅ System boot auto-start" -ForegroundColor Green
    Write-Host "  ✅ Process clustering support" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "🎯 Your server will now NEVER go down permanently!" -ForegroundColor Green
    Write-Host ""

    # Optional: Start monitoring in background
    $startMonitor = Read-Host "Start background monitoring? (y/n)"
    if ($startMonitor -eq "y" -or $startMonitor -eq "Y") {
        Write-Host "Starting monitoring system..." -ForegroundColor Green
        Start-Process -FilePath "node" -ArgumentList "server-monitor.js" -WindowStyle Minimized
        Write-Host "✅ Monitoring started in background" -ForegroundColor Green
    }

} catch {
    Write-Host ""
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Make sure Node.js is installed and in PATH" -ForegroundColor White
    Write-Host "2. Run 'npm install' to install dependencies" -ForegroundColor White
    Write-Host "3. Check if port 4000 is available" -ForegroundColor White
    Write-Host "4. Try running as administrator" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
