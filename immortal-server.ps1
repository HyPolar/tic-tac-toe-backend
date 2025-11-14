# TIC-TAC-TOE IMMORTAL SERVER SCRIPT
# This script ensures your server NEVER goes down, even in extreme circumstances

Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "   🛡️ TIC-TAC-TOE IMMORTAL SERVER PROTOCOL 🛡️" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""

function Write-Status($message, $type = "INFO") {
    $color = switch($type) {
        "SUCCESS" { "Green" }
        "WARNING" { "Yellow" }
        "ERROR" { "Red" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$type] $message" -ForegroundColor $color
}

function Test-ServerHealth {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get -TimeoutSec 5
        return $response.status -eq "ok"
    } catch {
        return $false
    }
}

function Start-ImmortalServer {
    Write-Status "Initiating Immortal Server Protocol..." "INFO"
    
    # Kill any existing processes to start fresh
    Write-Status "Cleaning up existing processes..." "INFO"
    try {
        Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
        Stop-Process -Name "pm2" -Force -ErrorAction SilentlyContinue
        Start-Sleep 2
    } catch { }

    # Create required directories
    $dirs = @("logs", "backup")
    foreach ($dir in $dirs) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
            Write-Status "Created directory: $dir" "SUCCESS"
        }
    }

    # Install/Update PM2
    Write-Status "Ensuring PM2 is properly installed..." "INFO"
    npm install -g pm2 --force
    
    # Start the server with PM2
    Write-Status "Starting server with PM2..." "INFO"
    npm run pm2:start
    Start-Sleep 5

    # Configure auto-startup
    Write-Status "Configuring system boot auto-start..." "INFO"
    try {
        pm2 startup
        pm2 save
        Write-Status "Auto-startup configured successfully" "SUCCESS"
    } catch {
        Write-Status "Auto-startup configuration failed (may need admin rights)" "WARNING"
    }

    # Start monitoring
    Write-Status "Starting advanced monitoring system..." "INFO"
    Start-Process -FilePath "node" -ArgumentList "server-monitor.js" -WindowStyle Hidden

    Write-Status "Immortal Server Protocol ACTIVATED!" "SUCCESS"
}

function Start-ContinuousMonitoring {
    Write-Status "Starting continuous monitoring loop..." "INFO"
    
    $failureCount = 0
    $maxFailures = 3
    $checkInterval = 10 # seconds
    
    while ($true) {
        if (Test-ServerHealth) {
            if ($failureCount -gt 0) {
                Write-Status "Server recovered! Resetting failure count." "SUCCESS"
                $failureCount = 0
            }
            Write-Host "." -NoNewline -ForegroundColor Green
        } else {
            $failureCount++
            Write-Status "Server health check failed! (Attempt $failureCount/$maxFailures)" "WARNING"
            
            if ($failureCount -ge $maxFailures) {
                Write-Status "Multiple failures detected. Initiating emergency recovery..." "ERROR"
                
                # Emergency recovery sequence
                Write-Status "Executing emergency PM2 restart..." "INFO"
                try {
                    pm2 restart tic-tac-toe-server
                    Start-Sleep 10
                    
                    if (Test-ServerHealth) {
                        Write-Status "Emergency restart successful!" "SUCCESS"
                        $failureCount = 0
                    } else {
                        Write-Status "PM2 restart failed. Trying direct restart..." "WARNING"
                        
                        # Kill and restart everything
                        Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
                        Start-Sleep 3
                        
                        npm run pm2:start
                        Start-Sleep 10
                        
                        if (Test-ServerHealth) {
                            Write-Status "Direct restart successful!" "SUCCESS"
                            $failureCount = 0
                        } else {
                            Write-Status "CRITICAL: All automatic recovery attempts failed!" "ERROR"
                            Write-Status "Attempting nuclear restart..." "WARNING"
                            
                            # Nuclear option - restart everything from scratch
                            pm2 kill
                            Start-Sleep 5
                            Start-ImmortalServer
                            $failureCount = 0
                        }
                    }
                } catch {
                    Write-Status "Emergency recovery error: $($_.Exception.Message)" "ERROR"
                }
            }
        }
        
        Start-Sleep $checkInterval
    }
}

# Main execution
try {
    Start-ImmortalServer
    
    # Wait for server to fully initialize
    Write-Status "Waiting for server initialization..." "INFO"
    $initTimeout = 30
    $initCount = 0
    
    while (!$(Test-ServerHealth) -and $initCount -lt $initTimeout) {
        Start-Sleep 1
        $initCount++
        Write-Host "." -NoNewline -ForegroundColor Yellow
    }
    
    if (Test-ServerHealth) {
        Write-Host ""
        Write-Status "Server is ONLINE and IMMORTAL!" "SUCCESS"
        
        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "   🎉 YOUR SERVER IS NOW TRULY IMMORTAL! 🎉" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "🛡️ Active Protection Systems:" -ForegroundColor Yellow
        Write-Host "  ✅ PM2 Auto-Restart on Crash" -ForegroundColor Green
        Write-Host "  ✅ Continuous Health Monitoring" -ForegroundColor Green
        Write-Host "  ✅ Emergency Recovery Procedures" -ForegroundColor Green
        Write-Host "  ✅ System Boot Auto-Start" -ForegroundColor Green
        Write-Host "  ✅ Nuclear Restart Capability" -ForegroundColor Green
        Write-Host "  ✅ Advanced Memory Management" -ForegroundColor Green
        Write-Host "  ✅ Multiple Failure Recovery" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "🔗 Server Endpoints:" -ForegroundColor Yellow
        Write-Host "  Game: http://localhost:4000" -ForegroundColor Cyan
        Write-Host "  Health: http://localhost:4000/health" -ForegroundColor Cyan
        Write-Host "  Monitor: http://localhost:4001/monitor/status" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Host "📊 Management Commands:" -ForegroundColor Yellow
        Write-Host "  npm run pm2:status   - Check server status" -ForegroundColor White
        Write-Host "  npm run pm2:logs     - View server logs" -ForegroundColor White
        Write-Host "  npm run pm2:monit    - Open PM2 monitoring" -ForegroundColor White
        Write-Host ""
        
        $startMonitoring = Read-Host "Start continuous monitoring? (Y/n)"
        if ($startMonitoring -ne "n" -and $startMonitoring -ne "N") {
            Write-Status "Starting immortal monitoring loop..." "INFO"
            Write-Status "Server will be monitored 24/7 and auto-recovered on any failure!" "SUCCESS"
            Write-Status "Press Ctrl+C to stop monitoring (server will continue running)" "INFO"
            Start-ContinuousMonitoring
        }
        
    } else {
        Write-Status "Server failed to initialize properly!" "ERROR"
        exit 1
    }
    
} catch {
    Write-Status "Critical error in immortal server script: $($_.Exception.Message)" "ERROR"
    exit 1
}
