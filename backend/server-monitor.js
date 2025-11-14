/**
 * Advanced Server Monitor and Auto-Recovery System
 * This module provides comprehensive monitoring and automatic recovery
 * to ensure the server NEVER goes down permanently.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ServerMonitor {
  constructor(options = {}) {
    this.options = {
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      healthCheckUrl: options.healthCheckUrl || 'http://localhost:4000/health',
      maxConsecutiveFailures: options.maxConsecutiveFailures || 3,
      restartCommand: options.restartCommand || 'npm start',
      logFile: options.logFile || path.join(__dirname, 'logs', 'monitor.log'),
      alertsEnabled: options.alertsEnabled || true,
      memoryThreshold: options.memoryThreshold || 500 * 1024 * 1024, // 500MB
      cpuThreshold: options.cpuThreshold || 90, // 90%
      ...options
    };
    
    this.failureCount = 0;
    this.isMonitoring = false;
    this.lastHealthCheck = null;
    this.serverProcess = null;
    this.startTime = new Date();
    this.stats = {
      totalRestarts: 0,
      totalHealthChecks: 0,
      totalFailures: 0,
      lastRestart: null
    };
  }

  /**
   * Enhanced health check that validates multiple aspects of server health
   */
  async performHealthCheck() {
    try {
      this.stats.totalHealthChecks++;
      
      // Check if server responds to HTTP requests
      const response = await this.checkHttpHealth();
      
      // Check system resources
      const resourceCheck = this.checkSystemResources();
      
      // Check disk space
      const diskCheck = this.checkDiskSpace();
      
      const healthStatus = {
        timestamp: new Date(),
        http: response.status === 'ok',
        httpLatency: response.latency,
        memory: resourceCheck.memory,
        cpu: resourceCheck.cpu,
        disk: diskCheck,
        uptime: process.uptime(),
        pid: process.pid
      };
      
      // Log health status
      this.logHealthStatus(healthStatus);
      
      if (healthStatus.http) {
        this.failureCount = 0;
        this.lastHealthCheck = healthStatus;
        return { success: true, status: healthStatus };
      } else {
        throw new Error('HTTP health check failed');
      }
    } catch (error) {
      this.failureCount++;
      this.stats.totalFailures++;
      
      this.log(`Health check failed (${this.failureCount}/${this.options.maxConsecutiveFailures}): ${error.message}`, 'ERROR');
      
      if (this.failureCount >= this.options.maxConsecutiveFailures) {
        await this.handleServerFailure();
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Check HTTP endpoint health
   */
  async checkHttpHealth() {
    const start = Date.now();
    
    try {
      const axios = require('axios');
      const response = await axios.get(this.options.healthCheckUrl, {
        timeout: 10000,
        validateStatus: () => true
      });
      
      const latency = Date.now() - start;
      
      if (response.status === 200 && response.data && response.data.status === 'ok') {
        return { status: 'ok', latency };
      } else {
        throw new Error(`Unexpected response: ${response.status} ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      throw new Error(`HTTP health check failed: ${error.message}`);
    }
  }

  /**
   * Check system resource usage
   */
  checkSystemResources() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        used: memUsage.rss,
        heap: memUsage.heapUsed,
        external: memUsage.external,
        threshold: this.options.memoryThreshold,
        withinLimit: memUsage.rss < this.options.memoryThreshold
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        loadAverage: os.loadavg()
      }
    };
  }

  /**
   * Check available disk space
   */
  checkDiskSpace() {
    try {
      const stats = fs.statSync(__dirname);
      return {
        available: true,
        path: __dirname
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Handle server failure - implement multiple recovery strategies
   */
  async handleServerFailure() {
    this.log('Server failure detected! Initiating recovery procedures...', 'ERROR');
    this.stats.totalRestarts++;
    this.stats.lastRestart = new Date();
    
    try {
      // Strategy 1: Graceful restart with PM2
      await this.restartWithPM2();
      
      // Wait for server to start
      await this.waitForServerStart();
      
      this.log('Server successfully restarted with PM2', 'INFO');
    } catch (pm2Error) {
      this.log(`PM2 restart failed: ${pm2Error.message}`, 'WARNING');
      
      try {
        // Strategy 2: Direct process restart
        await this.restartDirectly();
        await this.waitForServerStart();
        
        this.log('Server successfully restarted directly', 'INFO');
      } catch (directError) {
        this.log(`Direct restart failed: ${directError.message}`, 'ERROR');
        
        // Strategy 3: Emergency recovery
        await this.emergencyRecovery();
      }
    }
    
    // Reset failure counter after successful restart
    this.failureCount = 0;
  }

  /**
   * Restart server using PM2
   */
  async restartWithPM2() {
    return new Promise((resolve, reject) => {
      const pm2Restart = spawn('npx', ['pm2', 'restart', 'tic-tac-toe-server'], {
        stdio: 'pipe',
        shell: true
      });
      
      let output = '';
      pm2Restart.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pm2Restart.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      pm2Restart.on('close', (code) => {
        if (code === 0) {
          this.log('PM2 restart command executed successfully', 'INFO');
          resolve(output);
        } else {
          reject(new Error(`PM2 restart failed with code ${code}: ${output}`));
        }
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        pm2Restart.kill();
        reject(new Error('PM2 restart timed out'));
      }, 30000);
    });
  }

  /**
   * Restart server directly
   */
  async restartDirectly() {
    return new Promise((resolve, reject) => {
      // Kill existing process if any
      if (this.serverProcess) {
        this.serverProcess.kill();
      }
      
      // Start new process
      this.serverProcess = spawn('npm', ['start'], {
        stdio: 'pipe',
        shell: true,
        cwd: __dirname
      });
      
      this.serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });
      
      // Give the server time to start
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          resolve('Server process started');
        } else {
          reject(new Error('Server failed to start within timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Emergency recovery procedures
   */
  async emergencyRecovery() {
    this.log('Initiating emergency recovery procedures...', 'CRITICAL');
    
    // Clear any locks or temporary files
    try {
      const tempFiles = ['server.lock', '.pm2.lock', 'process.pid'];
      for (const file of tempFiles) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.log(`Removed lock file: ${file}`, 'INFO');
        }
      }
    } catch (error) {
      this.log(`Error during cleanup: ${error.message}`, 'WARNING');
    }
    
    // Send emergency alert
    if (this.options.alertsEnabled) {
      await this.sendEmergencyAlert();
    }
    
    // Attempt final restart
    try {
      await this.restartWithPM2();
      await this.waitForServerStart(60000); // Wait up to 1 minute
    } catch (finalError) {
      this.log('CRITICAL: All recovery attempts failed!', 'CRITICAL');
      // In a production environment, you might want to send SMS/email alerts here
    }
  }

  /**
   * Wait for server to start and respond to health checks
   */
  async waitForServerStart(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const healthCheck = await this.checkHttpHealth();
        if (healthCheck.status === 'ok') {
          this.log('Server is responding to health checks', 'INFO');
          return true;
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Server failed to start within timeout period');
  }

  /**
   * Send emergency alert
   */
  async sendEmergencyAlert() {
    const alertMessage = {
      timestamp: new Date(),
      server: 'Tic-Tac-Toe Server',
      status: 'CRITICAL',
      message: 'Server has failed and emergency recovery is in progress',
      stats: this.stats,
      systemInfo: {
        hostname: os.hostname(),
        platform: os.platform(),
        memory: os.totalmem(),
        uptime: os.uptime()
      }
    };
    
    // Log the alert
    this.log(`EMERGENCY ALERT: ${JSON.stringify(alertMessage)}`, 'CRITICAL');
    
    // In production, you could send this to external monitoring services:
    // - Send email via SendGrid, AWS SES, etc.
    // - Send SMS via Twilio
    // - Post to Slack/Discord webhooks
    // - Send to monitoring services like New Relic, DataDog
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      this.log('Monitor is already running', 'WARNING');
      return;
    }
    
    this.isMonitoring = true;
    this.log('Starting server monitoring...', 'INFO');
    
    // Initial health check
    this.performHealthCheck();
    
    // Set up periodic health checks
    this.monitorInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
    
    // Monitor system resources every minute
    this.resourceInterval = setInterval(() => {
      this.monitorResources();
    }, 60000);
    
    // Graceful shutdown handling
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Monitor system resources
   */
  monitorResources() {
    const resources = this.checkSystemResources();
    
    // Check memory usage
    if (!resources.memory.withinLimit) {
      this.log(`High memory usage detected: ${Math.round(resources.memory.used / 1024 / 1024)}MB`, 'WARNING');
    }
    
    // Check CPU load
    const avgLoad = resources.cpu.loadAverage[0];
    if (avgLoad > this.options.cpuThreshold / 100) {
      this.log(`High CPU load detected: ${(avgLoad * 100).toFixed(2)}%`, 'WARNING');
    }
  }

  /**
   * Stop monitoring
   */
  shutdown() {
    this.log('Shutting down monitor...', 'INFO');
    this.isMonitoring = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    
    if (this.resourceInterval) {
      clearInterval(this.resourceInterval);
    }
    
    this.log('Monitor shutdown complete', 'INFO');
  }

  /**
   * Log health status
   */
  logHealthStatus(status) {
    const summary = {
      timestamp: status.timestamp,
      status: status.http ? 'HEALTHY' : 'UNHEALTHY',
      latency: status.httpLatency,
      memoryMB: Math.round(status.memory.used / 1024 / 1024),
      uptime: Math.round(status.uptime)
    };
    
    this.log(`Health Check: ${JSON.stringify(summary)}`, status.http ? 'INFO' : 'WARNING');
  }

  /**
   * Enhanced logging with rotation
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    
    console.log(logEntry);
    
    // Ensure logs directory exists
    const logsDir = path.dirname(this.options.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Append to log file
    fs.appendFileSync(this.options.logFile, logEntry + '\n');
  }

  /**
   * Get monitor statistics
   */
  getStats() {
    return {
      ...this.stats,
      monitoring: this.isMonitoring,
      startTime: this.startTime,
      lastHealthCheck: this.lastHealthCheck,
      failureCount: this.failureCount
    };
  }
}

// If this file is run directly, start monitoring
if (require.main === module) {
  const monitor = new ServerMonitor({
    healthCheckInterval: 15000, // Check every 15 seconds
    maxConsecutiveFailures: 2,  // Restart after 2 failures
    alertsEnabled: true
  });
  
  monitor.startMonitoring();
  
  // Expose monitor stats via HTTP endpoint
  const express = require('express');
  const monitorApp = express();
  
  monitorApp.get('/monitor/status', (req, res) => {
    res.json(monitor.getStats());
  });
  
  monitorApp.listen(4001, () => {
    monitor.log('Monitor status endpoint available at http://localhost:4001/monitor/status', 'INFO');
  });
}

module.exports = { ServerMonitor };
