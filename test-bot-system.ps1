# Bot System Test Script for Tic-Tac-Toe Server
# Tests all bot functionality and reports results

param(
    [string]$ServerUrl = "http://localhost:4000",
    [switch]$Detailed = $false
)

Write-Host "🤖 Testing Tic-Tac-Toe Bot System" -ForegroundColor Green
Write-Host "Server: $ServerUrl" -ForegroundColor Yellow
Write-Host "=" * 50

# Test bot statistics endpoint
Write-Host "`n📊 Testing bot statistics..." -ForegroundColor Cyan
try {
    $statsResponse = Invoke-RestMethod -Uri "$ServerUrl/api/bots/stats" -Method Get
    Write-Host "✅ Bot stats retrieved successfully" -ForegroundColor Green
    Write-Host "   Total Games: $($statsResponse.totalGames)" -ForegroundColor White
    Write-Host "   Win Rate: $($statsResponse.winRate)" -ForegroundColor White
    Write-Host "   Active Bots: $($statsResponse.activeBots)" -ForegroundColor White
    Write-Host "   Tracked Players: $($statsResponse.trackedPlayers)" -ForegroundColor White
} catch {
    Write-Host "❌ Failed to get bot stats: $($_.Exception.Message)" -ForegroundColor Red
}

# Test active bots endpoint
Write-Host "`n🎮 Testing active bot games..." -ForegroundColor Cyan
try {
    $activeResponse = Invoke-RestMethod -Uri "$ServerUrl/api/bots/active" -Method Get
    Write-Host "✅ Active bot games retrieved successfully" -ForegroundColor Green
    Write-Host "   Active Games: $($activeResponse.totalActive)" -ForegroundColor White
    
    if ($Detailed -and $activeResponse.activeBotGames.Count -gt 0) {
        Write-Host "   Game Details:" -ForegroundColor Yellow
        foreach ($game in $activeResponse.activeBotGames) {
            Write-Host "     - Game: $($game.gameId), Bet: $($game.betAmount) SATS, Should Win: $($game.shouldWin)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Failed to get active bot games: $($_.Exception.Message)" -ForegroundColor Red
}

# Test bot patterns endpoint
Write-Host "`n🎯 Testing bot patterns..." -ForegroundColor Cyan
try {
    $patternsResponse = Invoke-RestMethod -Uri "$ServerUrl/api/bots/patterns" -Method Get
    Write-Host "✅ Bot patterns retrieved successfully" -ForegroundColor Green
    Write-Host "   Available Patterns: $($patternsResponse.patterns.PSObject.Properties.Name -join ', ')" -ForegroundColor White
    Write-Host "   Difficulty Levels: $($patternsResponse.difficultyInfo.PSObject.Properties.Name.Count)" -ForegroundColor White
    Write-Host "   Spawn Delay: $($patternsResponse.spawnDelay)" -ForegroundColor White
    Write-Host "   Thinking Time: $($patternsResponse.thinkingTime)" -ForegroundColor White
    
    if ($Detailed) {
        Write-Host "   Pattern Details:" -ForegroundColor Yellow
        foreach ($pattern in $patternsResponse.patterns.PSObject.Properties) {
            Write-Host "     - $($pattern.Name): $($pattern.Value.pattern -join ',')" -ForegroundColor Gray
            Write-Host "       $($pattern.Value.description)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Failed to get bot patterns: $($_.Exception.Message)" -ForegroundColor Red
}

# Test bot spawn functionality
Write-Host "`n🚀 Testing bot spawn..." -ForegroundColor Cyan
$testBetAmounts = @(50, 300, 500)
$spawnedBots = @()

foreach ($betAmount in $testBetAmounts) {
    try {
        $spawnBody = @{
            betAmount = $betAmount
            playerAddress = "test@speed.app"
        } | ConvertTo-Json
        
        $spawnResponse = Invoke-RestMethod -Uri "$ServerUrl/api/bots/force-spawn" -Method Post -Body $spawnBody -ContentType "application/json"
        
        if ($spawnResponse.success) {
            Write-Host "✅ Bot spawned successfully for $betAmount SATS" -ForegroundColor Green
            Write-Host "   Game ID: $($spawnResponse.gameId)" -ForegroundColor White
            Write-Host "   Bot Should Win: $($spawnResponse.botShouldWin)" -ForegroundColor White
            $spawnedBots += $spawnResponse.gameId
        } else {
            Write-Host "❌ Bot spawn failed for $betAmount SATS" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Bot spawn error for $betAmount SATS: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

# Test player history (should return 404 for test player)
Write-Host "`n👤 Testing player history..." -ForegroundColor Cyan
try {
    $historyResponse = Invoke-RestMethod -Uri "$ServerUrl/api/bots/player-history/test@speed.app" -Method Get
    Write-Host "✅ Player history retrieved" -ForegroundColor Green
    Write-Host "   Games Played: $($historyResponse.gameHistory.gamesPlayed)" -ForegroundColor White
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "✅ Player history test passed (404 expected for new test player)" -ForegroundColor Green
    } else {
        Write-Host "❌ Player history error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n" + "=" * 50
Write-Host "🎯 Bot System Test Summary" -ForegroundColor Green
Write-Host "Server URL: $ServerUrl" -ForegroundColor White

if ($spawnedBots.Count -gt 0) {
    Write-Host "✅ Successfully spawned $($spawnedBots.Count) test bots" -ForegroundColor Green
    Write-Host "⚠️  Test bots will be cleaned up automatically by the server" -ForegroundColor Yellow
} else {
    Write-Host "❌ No bots were spawned during testing" -ForegroundColor Red
}

Write-Host "`n🎯 Bot Logic Summary:" -ForegroundColor Cyan
Write-Host "  50 SATS:  W-L-W-W-L-L-L-W-L (repeats) - Player wins first" -ForegroundColor White
Write-Host "  300+ SATS: L-W-L-W-L-L-W-L-W (repeats) - Player loses first" -ForegroundColor White
Write-Host "  Revenge:  Same LN address + same bet amount = guaranteed win" -ForegroundColor Yellow
Write-Host "  Timing:   First turn 8s, subsequent turns 5s, draws 5s" -ForegroundColor White
Write-Host "  Draws:    Fair games: bot loses after 2-5 draws" -ForegroundColor White
Write-Host "            Cheating games: bot wins after 3-4 draws" -ForegroundColor White

Write-Host "`n🔧 Bot Management Commands:" -ForegroundColor Cyan
Write-Host "  GET  /api/bots/stats              - Get bot statistics" -ForegroundColor White
Write-Host "  GET  /api/bots/active             - Get active bot games" -ForegroundColor White
Write-Host "  GET  /api/bots/patterns           - Get bot patterns and logic" -ForegroundColor White
Write-Host "  GET  /api/bots/player-history/:addr - Get player bot history" -ForegroundColor White
Write-Host "  POST /api/bots/force-spawn        - Force spawn test bot" -ForegroundColor White
Write-Host "  POST /api/bots/reset-stats        - Reset bot statistics" -ForegroundColor White

Write-Host "`n💡 Monitor Bot System:" -ForegroundColor Cyan
Write-Host "  node backend/bot-monitor.js       - Start continuous monitoring" -ForegroundColor White
Write-Host "  node backend/bot-monitor.js --report - Generate detailed report" -ForegroundColor White
Write-Host "  node backend/bot-monitor.js --test   - Run comprehensive tests" -ForegroundColor White

Write-Host "`n🤖 Bot system testing completed!" -ForegroundColor Green
