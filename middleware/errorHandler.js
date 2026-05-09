/**
 * Global Error Handler Middleware
 * Centralized error processing for all Express routes
 */

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // ========================
  // Mongoose Validation Error
  // ========================

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message
    }));
  }

  // ========================
  // Mongoose Cast Error (invalid ObjectId)
  // ========================

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ========================
  // MongoDB Duplicate Key Error
  // ========================

  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // ========================
  // JWT Errors
  // ========================

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please login again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired. Please login again.';
  }

  // ========================
  // Multer Errors (file upload)
  // ========================

  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = `File too large. Maximum size is ${Math.round(process.env.MAX_FILE_SIZE / 1024 / 1024)}MB`;
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field. Only resume files are accepted.';
  }

  // ========================
  // Send Response
  // ========================

  const response = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      originalError: err.message
    })
  };

  // Log error in development
  
  if (process.env.NODE_ENV === 'development') {
    console.error(`❌ [${statusCode}] ${message}`, err.stack ? '\n' + err.stack : '');
  } else {
    // In production, only log 5xx errors
    if (statusCode >= 500) {
      console.error(`❌ [${statusCode}] ${message}`, req.method, req.url);
    }
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
