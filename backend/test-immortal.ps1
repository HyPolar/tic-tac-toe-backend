# Test script for Immortal Server setup
Write-Host "🧪 Testing Immortal Server Configuration..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if PM2 is installed
Write-Host "[TEST 1] Checking PM2 installation..." -ForegroundColor Yellow
try {
    $pm2Version = pm2 --version
    Write-Host "✅ PM2 is installed: $pm2Version" -ForegroundColor Green
} catch {
    Write-Host "❌ PM2 is not installed" -ForegroundColor Red
    Write-Host "Installing PM2..." -ForegroundColor Yellow
    npm install -g pm2
}

# Test 2: Check ecosystem config
Write-Host "[TEST 2] Checking ecosystem configuration..." -ForegroundColor Yellow
if (Test-Path "ecosystem.config.js") {
    Write-Host "✅ ecosystem.config.js found" -ForegroundColor Green
} else {
    Write-Host "❌ ecosystem.config.js missing" -ForegroundColor Red
}

# Test 3: Check server files
Write-Host "[TEST 3] Checking server files..." -ForegroundColor Yellow
$requiredFiles = @("server.js", "server-monitor.js", "backend/health-system.js", "package.json")
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file found" -ForegroundColor Green
    } else {
        Write-Host "❌ $file missing" -ForegroundColor Red
    }
}

# Test 4: Check immortal scripts
Write-Host "[TEST 4] Checking immortal scripts..." -ForegroundColor Yellow
$scripts = @("immortal-server.ps1", "immortal-server.bat", "start-forever.ps1", "start-forever.bat")
foreach ($script in $scripts) {
    if (Test-Path $script) {
        Write-Host "✅ $script found" -ForegroundColor Green
    } else {
        Write-Host "❌ $script missing" -ForegroundColor Red
    }
}

# Test 5: Check package.json scripts
Write-Host "[TEST 5] Checking package.json scripts..." -ForegroundColor Yellow
try {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $immortalCommands = @("immortal", "never-down", "pm2:start", "emergency-restart", "nuke-restart")
    foreach ($cmd in $immortalCommands) {
        if ($packageJson.scripts.$cmd) {
            Write-Host "✅ npm run $cmd available" -ForegroundColor Green
        } else {
            Write-Host "❌ npm run $cmd missing" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ Error reading package.json" -ForegroundColor Red
}

# Test 6: Check logs directory
Write-Host "[TEST 6] Checking logs directory..." -ForegroundColor Yellow
if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Force -Path "logs" | Out-Null
    Write-Host "✅ Created logs directory" -ForegroundColor Green
} else {
    Write-Host "✅ Logs directory exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎯 IMMORTAL SERVER CONFIGURATION TEST COMPLETE!" -ForegroundColor Magenta
Write-Host ""
Write-Host "📝 To start your immortal server, run:" -ForegroundColor Yellow
Write-Host "   npm run immortal" -ForegroundColor Cyan
Write-Host "   OR" -ForegroundColor Yellow
Write-Host "   npm run pm2:start" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔗 Health endpoints will be available at:" -ForegroundColor Yellow
Write-Host "   http://localhost:4000/health" -ForegroundColor Cyan
Write-Host "   http://localhost:4000/health/immortal" -ForegroundColor Cyan
Write-Host "   http://localhost:4001/monitor/status" -ForegroundColor Cyan
