module.exports = {
  apps: [{
    name: 'tic-tac-toe-server',
    script: 'server.js',
    cwd: './backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Environment variables
    env: {
      NODE_ENV: 'development',
      PORT: 4000,
      BACKEND_PORT: 4000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 4000,
      BACKEND_PORT: process.env.BACKEND_PORT || 4000
    },

    // Restart policy - NEVER GIVE UP!
    min_uptime: '10s',           // Consider app online after 10s
    max_restarts: 50,            // Allow up to 50 restarts per minute
    restart_delay: 4000,         // Wait 4s between restarts
    exp_backoff_restart_delay: 100, // Exponential backoff on consecutive crashes
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    
    // Logging
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    
    // Advanced restart conditions
    listen_timeout: 8000,        // Time to wait before considering app online
    kill_timeout: 5000,          // Time to wait before force killing
    
    // ULTIMATE NEVER-DOWN ENHANCEMENTS
    max_restarts: 100,           // Allow unlimited restarts
    min_uptime: '5s',            // Consider online faster for quick recovery
    restart_delay: 2000,         // Faster restart delay
    increment_var: 'NODE_APP_INSTANCE', // Support multiple instances
    
    // Enhanced error handling
    combine_logs: true,
    merge_logs: true,
    log_type: 'json',
    
    // Advanced process management
    windowsHide: true,           // Hide PM2 windows on Windows
    treekill: true,              // Kill process tree on restart
    
    // CPU and memory monitoring
    max_memory_restart: '500M',  // Restart if memory exceeds 500MB
    
    // Source map support for better error tracking
    source_map_support: true,
    
    // Graceful shutdown
    wait_ready: true,
    
    // Cluster mode settings (can be enabled for high load)
    // instances: 'max',          // Use all CPU cores
    // exec_mode: 'cluster',      // Enable cluster mode
    
    // Custom restart conditions
    ignore_watch: ['node_modules', 'logs'],
    
    // Advanced options for maximum uptime
    vizion: false,               // Disable git interaction
    autorestart: true,           // Always restart on crash
    force: true,                 // Force start even if another process exists
    
    // Cron-based restart (optional - restart daily at 3 AM)
    cron_restart: '0 3 * * *',   // Daily restart for memory cleanup
    
    // Network and connection settings
    listen_timeout: 8000,
    kill_timeout: 5000,
    wait_ready: true,
    
    // Process monitoring
    pmx: true,                   // Enable PMX monitoring
    automation: false,           // Disable keymetrics automation
    
    // Environment-specific overrides
    node_args: '--max-old-space-size=1024', // Increase memory limit
    
    // Merge logs for easier monitoring
    merge_logs: true,
    
    // Time zone
    time: true
  }]
};
