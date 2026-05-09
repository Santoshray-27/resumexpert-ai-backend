const path = require('path');

module.exports = {
  apps: [
    {
      name: 'resumexpert-ai-backend',
      script: './server.js',
      // Dynamic cwd using __dirname ensures it works on any server
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      watch: false,
      instances: 'max',
      exec_mode: 'cluster',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Auto-restart on memory leak
      max_memory_restart: '1G'
    }
  ]
};

