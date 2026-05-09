/**
 * PM2 Ecosystem Config for ResumeXpert AI
 * Runs the Express backend which also serves the built frontend
 */
module.exports = {
  apps: [
    {
      name: 'resumexpert-ai-backend',
      script: 'server.js',
      cwd: '/home/user/smart-resume-analyzer/backend',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
