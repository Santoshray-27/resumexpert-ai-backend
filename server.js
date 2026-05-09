/**
 * ResumeXpert AI - Main Server Entry Point
 * Production-ready Express.js backend with MongoDB
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import database connection
const connectDB = require('./config/database');

// Import route handlers
const authRoutes = require('./routes/auth.routes');
const resumeRoutes = require('./routes/resume.routes');
const analysisRoutes = require('./routes/analysis.routes');
const jobRoutes = require('./routes/job.routes');
const interviewRoutes = require('./routes/interview.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const screeningRoutes = require('./routes/screening.routes');

// Import error handling middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Initialize Express app
const app = express();

// Trust proxy (Required for rate limiting to work behind Railway/Render/Vercel proxies)
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// ========================
// 1. Rate Limiting (Production Safety)
// ========================

// Global Rate Limiter: 100 requests per 15 mins
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth Limiter: 10 requests per 15 mins (Prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI Usage Limiter: 20 requests per hour (Prevent API credit exhaustion)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Hourly AI usage limit reached. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================
// 2. Security Middleware
// ========================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://*"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// ========================
// 3. CORS Configuration
// ========================
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'http://localhost:4173' // Vite preview
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ========================
// 4. Request Parsing & Logging
// ========================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ========================
// 5. API Routes with Targeted Rate Limits
// ========================

// Health Check (Excluded from global limits)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'ResumeXpert AI API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: '1.2.0'
  });
});

// Apply global rate limit to all other API routes
app.use('/api', globalLimiter);

// Auth Routes (Strict Limit)
app.use('/api/auth', authLimiter, authRoutes);

// AI & Heavy Processing Routes (Specific Limit)
app.use('/api/analysis', aiLimiter, analysisRoutes);
app.use('/api/interviews', aiLimiter, interviewRoutes);
app.use('/api/screening', aiLimiter, screeningRoutes);

// Standard Data Routes
app.use('/api/resumes', resumeRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ========================
// 6. Static File Serving
// ========================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ========================
// 7. Error Handling
// ========================
app.use(notFound);
app.use(errorHandler);

// ========================
// 8. Start Server
// ========================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║           ResumeXpert AI Backend       ║
╠════════════════════════════════════════╣
║  Status:   ✅ Running                  ║
║  Port:     ${PORT}                        ║
║  Mode:     ${process.env.NODE_ENV || 'production'}                 ║
║  API:      http://localhost:${PORT}/api   ║
╚════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! Shutting down...', err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...', err.name, err.message);
  process.exit(1);
});

module.exports = app;

