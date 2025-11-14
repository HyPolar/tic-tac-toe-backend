#!/usr/bin/env node

/**
 * Bot Monitoring and Testing Script for Tic-Tac-Toe Server
 * 
 * This script provides comprehensive monitoring and testing capabilities
 * for the bot system, including performance analysis and game simulation.
 */

const axios = require('axios');
const winston = require('winston');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/bot-monitor.log' })
  ]
});

// Configuration
const CONFIG = {
  serverUrl: process.env.SERVER_URL || 'http://localhost:4000',
  testBetAmounts: [50, 300, 500, 1000, 5000],
  testPlayerAddress: 'monitor@speed.app',
  monitorInterval: 30000, // 30 seconds
  testInterval: 300000,   // 5 minutes
};

class BotMonitor {
  constructor() {
    this.isRunning = false;
    this.stats = {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      averageResponseTime: 0
    };
  }

  async start() {
    this.isRunning = true;
    logger.info('🤖 Bot Monitor starting...');
    
    // Initial status check
    await this.checkBotStatus();
    
    // Start monitoring intervals
    this.statusInterval = setInterval(() => this.checkBotStatus(), CONFIG.monitorInterval);
    this.testInterval = setInterval(() => this.runBotTests(), CONFIG.testInterval);
    
    // Run initial tests
    setTimeout(() => this.runBotTests(), 5000);
    
    logger.info('✅ Bot Monitor is now running');
    console.log('\n📊 Monitor Commands:');
    console.log('  Ctrl+C - Stop monitoring');
    console.log('  Check logs/bot-monitor.log for detailed monitoring data\n');
  }

  async stop() {
    this.isRunning = false;
    if (this.statusInterval) clearInterval(this.statusInterval);
    if (this.testInterval) clearInterval(this.testInterval);
    logger.info('🛑 Bot Monitor stopped');
  }

  async checkBotStatus() {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${CONFIG.serverUrl}/api/bots/stats`);
      const responseTime = Date.now() - startTime;
      
      const stats = response.data;
      
      logger.info(`📈 Bot Stats - Games: ${stats.totalGames}, Win Rate: ${stats.winRate}, Active: ${stats.activeBots}, Response: ${responseTime}ms`);
      
      // Check for concerning patterns
      if (stats.activeBots > 10) {
        logger.warn(`⚠️  High number of active bots: ${stats.activeBots}`);
      }
      
      if (stats.totalGames > 0) {
        const winRate = parseFloat(stats.winRate.replace('%', ''));
        if (winRate > 80) {
          logger.warn(`⚠️  Bot win rate unusually high: ${stats.winRate}`);
        } else if (winRate < 20) {
          logger.warn(`⚠️  Bot win rate unusually low: ${stats.winRate}`);
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`❌ Failed to check bot status: ${error.message}`);
      return false;
    }
  }

  async runBotTests() {
    logger.info('🧪 Starting bot functionality tests...');
    
    for (const betAmount of CONFIG.testBetAmounts) {
      await this.testBotSpawn(betAmount);
      await this.sleep(2000); // Wait between tests
    }
    
    await this.testBotPatterns();
    await this.testPlayerHistory();
    
    logger.info(`✅ Bot tests completed. Success rate: ${this.getSuccessRate()}%`);
  }

  async testBotSpawn(betAmount) {
    try {
      this.stats.totalTests++;
      
      const response = await axios.post(`${CONFIG.serverUrl}/api/bots/force-spawn`, {
        betAmount,
        playerAddress: CONFIG.testPlayerAddress
      });
      
      if (response.data.success) {
        this.stats.successfulTests++;
        logger.info(`✅ Bot spawn test passed for ${betAmount} SATS`);
        
        // Clean up test bot after a short delay
        setTimeout(async () => {
          try {
            const gameId = response.data.gameId;
            // The bot will be cleaned up automatically by the server
            logger.info(`🧹 Test bot ${gameId} will be cleaned up automatically`);
          } catch (cleanupError) {
            logger.warn(`⚠️  Test bot cleanup warning: ${cleanupError.message}`);
          }
        }, 5000);
        
      } else {
        this.stats.failedTests++;
        logger.error(`❌ Bot spawn test failed for ${betAmount} SATS`);
      }
    } catch (error) {
      this.stats.failedTests++;
      logger.error(`❌ Bot spawn test error for ${betAmount} SATS: ${error.message}`);
    }
  }

  async testBotPatterns() {
    try {
      this.stats.totalTests++;
      
      const response = await axios.get(`${CONFIG.serverUrl}/api/bots/patterns`);
      const patterns = response.data;
      
      if (patterns.patterns && patterns.difficultyInfo) {
        this.stats.successfulTests++;
        logger.info('✅ Bot patterns test passed');
        logger.info(`🎯 Available patterns: ${Object.keys(patterns.patterns).join(', ')}`);
        logger.info(`🎖️  Difficulty levels: ${Object.keys(patterns.difficultyInfo).length}`);
      } else {
        this.stats.failedTests++;
        logger.error('❌ Bot patterns test failed - incomplete data');
      }
    } catch (error) {
      this.stats.failedTests++;
      logger.error(`❌ Bot patterns test error: ${error.message}`);
    }
  }

  async testPlayerHistory() {
    try {
      this.stats.totalTests++;
      
      const response = await axios.get(`${CONFIG.serverUrl}/api/bots/player-history/${CONFIG.testPlayerAddress}`);
      
      // It's OK if no history exists for test player
      if (response.status === 200 || response.status === 404) {
        this.stats.successfulTests++;
        logger.info('✅ Player history test passed');
      } else {
        this.stats.failedTests++;
        logger.error('❌ Player history test failed');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        this.stats.successfulTests++;
        logger.info('✅ Player history test passed (no history found - expected for test)');
      } else {
        this.stats.failedTests++;
        logger.error(`❌ Player history test error: ${error.message}`);
      }
    }
  }

  getSuccessRate() {
    if (this.stats.totalTests === 0) return 0;
    return Math.round((this.stats.successfulTests / this.stats.totalTests) * 100);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateReport() {
    logger.info('📋 Generating comprehensive bot report...');
    
    try {
      const [statsResponse, activeResponse, patternsResponse] = await Promise.all([
        axios.get(`${CONFIG.serverUrl}/api/bots/stats`),
        axios.get(`${CONFIG.serverUrl}/api/bots/active`),
        axios.get(`${CONFIG.serverUrl}/api/bots/patterns`)
      ]);

      const report = {
        timestamp: new Date().toISOString(),
        botStats: statsResponse.data,
        activeBots: activeResponse.data,
        patterns: patternsResponse.data,
        monitorStats: this.stats,
        serverUrl: CONFIG.serverUrl
      };

      const reportJson = JSON.stringify(report, null, 2);
      require('fs').writeFileSync(`logs/bot-report-${Date.now()}.json`, reportJson);
      
      logger.info('✅ Bot report generated successfully');
      console.log('\n📊 Current Bot Status:');
      console.log(`   Total Games: ${report.botStats.totalGames}`);
      console.log(`   Win Rate: ${report.botStats.winRate}`);
      console.log(`   Active Bots: ${report.botStats.activeBots}`);
      console.log(`   Tracked Players: ${report.botStats.trackedPlayers}`);
      console.log(`   Monitor Success Rate: ${this.getSuccessRate()}%\n`);
      
    } catch (error) {
      logger.error(`❌ Failed to generate bot report: ${error.message}`);
    }
  }
}

// CLI handling
if (require.main === module) {
  const monitor = new BotMonitor();
  
  // Handle CLI arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--report')) {
    monitor.generateReport().then(() => process.exit(0));
  } else if (args.includes('--test')) {
    monitor.runBotTests().then(() => process.exit(0));
  } else if (args.includes('--status')) {
    monitor.checkBotStatus().then(() => process.exit(0));
  } else {
    // Start continuous monitoring
    monitor.start();
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n⏹️  Shutting down bot monitor...');
      await monitor.stop();
      process.exit(0);
    });
  }
}

module.exports = BotMonitor;
