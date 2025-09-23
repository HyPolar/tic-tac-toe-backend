/**
 * Advanced Health System for Immortal Server
 * Provides comprehensive health monitoring and self-healing capabilities
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class HealthSystem {
    constructor() {
        this.startTime = new Date();
        this.healthChecks = {
            database: true,
            memory: true,
            disk: true,
            network: true,
            processes: true
        };
        this.lastHealthCheck = null;
        this.failureHistory = [];
        this.autoHealingEnabled = true;
    }

    /**
     * Comprehensive health check
     */
    async getFullHealthStatus() {
        const healthStatus = {
            timestamp: new Date().toISOString(),
            status: 'ok',
            uptime: this.getUptime(),
            system: await this.getSystemHealth(),
            server: this.getServerHealth(),
            security: this.getSecurityStatus(),
            performance: this.getPerformanceMetrics(),
            recovery: this.getRecoveryStatus(),
            lastFailures: this.getRecentFailures()
        };

        // Determine overall status
        const criticalIssues = this.findCriticalIssues(healthStatus);
        if (criticalIssues.length > 0) {
            healthStatus.status = 'critical';
            healthStatus.issues = criticalIssues;
            
            if (this.autoHealingEnabled) {
                this.initiateAutoHealing(criticalIssues);
            }
        } else if (this.hasWarnings(healthStatus)) {
            healthStatus.status = 'warning';
        }

        this.lastHealthCheck = healthStatus;
        return healthStatus;
    }

    /**
     * Get system health information
     */
    async getSystemHealth() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
                process: {
                    rss: memUsage.rss,
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    external: memUsage.external
                },
                percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
            },
            cpu: {
                model: os.cpus()[0].model,
                cores: os.cpus().length,
                loadAverage: os.loadavg(),
                usage: cpuUsage
            },
            disk: await this.getDiskUsage(),
            network: this.getNetworkStatus(),
            platform: {
                type: os.type(),
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname()
            }
        };
    }

    /**
     * Get server-specific health
     */
    getServerHealth() {
        return {
            pid: process.pid,
            version: process.version,
            uptime: process.uptime(),
            nodeVersion: process.version,
            pm2Status: this.getPM2Status(),
            activeConnections: this.getActiveConnections(),
            errorRate: this.getErrorRate(),
            responseTime: this.getAverageResponseTime()
        };
    }

    /**
     * Get security status
     */
    getSecurityStatus() {
        return {
            httpsEnabled: false, // Update based on your HTTPS config
            corsConfigured: true,
            rateLimitingActive: true,
            environmentSecure: process.env.NODE_ENV === 'production',
            secretsSecure: this.areSecretsSecure(),
            lastSecurityScan: null // Could integrate with security scanning tools
        };
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            averageResponseTime: this.getAverageResponseTime(),
            requestsPerSecond: this.getRequestsPerSecond(),
            errorRate: this.getErrorRate(),
            memoryLeaks: this.detectMemoryLeaks(),
            cpuUsageHistory: this.getCpuUsageHistory()
        };
    }

    /**
     * Get recovery system status
     */
    getRecoveryStatus() {
        return {
            autoHealingEnabled: this.autoHealingEnabled,
            pm2Configured: true,
            monitoringActive: true,
            backupSystemReady: this.isBackupSystemReady(),
            lastRecoveryAction: this.getLastRecoveryAction(),
            recoveryCapabilities: [
                'PM2 Auto-restart',
                'Process Recovery',
                'Memory Cleanup',
                'Network Reset',
                'Emergency Restart',
                'Nuclear Restart'
            ]
        };
    }

    /**
     * Get recent failures
     */
    getRecentFailures() {
        const recentTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
        return this.failureHistory.filter(failure => 
            new Date(failure.timestamp) > recentTime
        );
    }

    /**
     * Find critical issues
     */
    findCriticalIssues(healthStatus) {
        const issues = [];

        // Memory check
        if (healthStatus.system.memory.percentage > 90) {
            issues.push({
                type: 'critical',
                category: 'memory',
                message: 'High memory usage detected',
                value: `${healthStatus.system.memory.percentage}%`
            });
        }

        // CPU check
        const avgLoad = healthStatus.system.cpu.loadAverage[0];
        if (avgLoad > 4) {
            issues.push({
                type: 'critical',
                category: 'cpu',
                message: 'High CPU load detected',
                value: avgLoad.toFixed(2)
            });
        }

        // Disk space check
        if (healthStatus.system.disk.usage > 90) {
            issues.push({
                type: 'critical',
                category: 'disk',
                message: 'Low disk space',
                value: `${healthStatus.system.disk.usage}%`
            });
        }

        return issues;
    }

    /**
     * Check for warnings
     */
    hasWarnings(healthStatus) {
        const memUsage = healthStatus.system.memory.percentage;
        const diskUsage = healthStatus.system.disk.usage;
        const avgLoad = healthStatus.system.cpu.loadAverage[0];

        return memUsage > 70 || diskUsage > 80 || avgLoad > 2;
    }

    /**
     * Initiate auto-healing procedures
     */
    async initiateAutoHealing(issues) {
        console.log('🚑 Auto-healing initiated for issues:', issues);

        for (const issue of issues) {
            try {
                switch (issue.category) {
                    case 'memory':
                        await this.performMemoryRecovery();
                        break;
                    case 'cpu':
                        await this.performCpuRecovery();
                        break;
                    case 'disk':
                        await this.performDiskCleanup();
                        break;
                    default:
                        await this.performGeneralRecovery();
                }
            } catch (error) {
                console.error(`Auto-healing failed for ${issue.category}:`, error);
                this.recordFailure(issue.category, error.message);
            }
        }
    }

    /**
     * Perform memory recovery
     */
    async performMemoryRecovery() {
        console.log('🧠 Performing memory recovery...');
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        // Clear caches if they exist
        if (global.cache) {
            global.cache.clear();
        }

        // Restart if memory is critically high
        const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        if (memUsage > 500) { // 500MB
            this.restartWithPM2();
        }
    }

    /**
     * Perform CPU recovery
     */
    async performCpuRecovery() {
        console.log('⚡ Performing CPU recovery...');
        
        // Add small delay to reduce CPU pressure
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Could implement more sophisticated CPU throttling here
    }

    /**
     * Perform disk cleanup
     */
    async performDiskCleanup() {
        console.log('🧹 Performing disk cleanup...');
        
        try {
            // Clean old log files
            const logsDir = path.join(__dirname, '..', 'logs');
            if (fs.existsSync(logsDir)) {
                const files = fs.readdirSync(logsDir);
                const oldFiles = files.filter(file => {
                    const filePath = path.join(logsDir, file);
                    const stats = fs.statSync(filePath);
                    const daysDiff = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                    return daysDiff > 7; // Files older than 7 days
                });

                for (const file of oldFiles) {
                    fs.unlinkSync(path.join(logsDir, file));
                    console.log(`Deleted old log file: ${file}`);
                }
            }
        } catch (error) {
            console.error('Disk cleanup error:', error);
        }
    }

    /**
     * Perform general recovery
     */
    async performGeneralRecovery() {
        console.log('🔧 Performing general recovery...');
        // Implement general recovery procedures
    }

    /**
     * Restart with PM2
     */
    restartWithPM2() {
        console.log('🔄 Restarting server with PM2...');
        const pm2Restart = spawn('npx', ['pm2', 'restart', 'tic-tac-toe-server'], {
            stdio: 'inherit',
            shell: true
        });
    }

    /**
     * Record failure for history tracking
     */
    recordFailure(category, message) {
        this.failureHistory.push({
            timestamp: new Date().toISOString(),
            category,
            message,
            autoHealed: false
        });

        // Keep only last 100 failures
        if (this.failureHistory.length > 100) {
            this.failureHistory = this.failureHistory.slice(-100);
        }
    }

    /**
     * Helper methods (implement based on your specific needs)
     */
    getUptime() {
        return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    }

    async getDiskUsage() {
        // Simplified disk usage check
        try {
            const stats = fs.statSync(__dirname);
            return {
                available: true,
                usage: 50, // Placeholder - implement actual disk usage check
                free: '10GB',
                total: '50GB'
            };
        } catch {
            return { available: false, usage: 0 };
        }
    }

    getNetworkStatus() {
        return {
            connected: true,
            latency: 50,
            externalAccess: true
        };
    }

    getPM2Status() {
        return 'running'; // Placeholder
    }

    getActiveConnections() {
        return 0; // Implement based on your server
    }

    getErrorRate() {
        return 0.01; // 1% error rate placeholder
    }

    getAverageResponseTime() {
        return 150; // 150ms placeholder
    }

    areSecretsSecure() {
        return process.env.SPEED_WALLET_SECRET_KEY && 
               process.env.SPEED_WALLET_SECRET_KEY !== 'your-secret-key';
    }

    getRequestsPerSecond() {
        return 10; // Placeholder
    }

    detectMemoryLeaks() {
        return false; // Placeholder
    }

    getCpuUsageHistory() {
        return []; // Placeholder
    }

    isBackupSystemReady() {
        return fs.existsSync(path.join(__dirname, '..', 'backup'));
    }

    getLastRecoveryAction() {
        return null; // Placeholder
    }
}

module.exports = { HealthSystem };
