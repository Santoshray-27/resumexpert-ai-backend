/**
 * Authentication Middleware
 * JWT verification and role-based access control
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

/**
 * Protect routes - requires valid JWT token
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Also check cookie (for browser-based requests)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // No token provided
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database (exclude password)
    let user;
    try {
      user = await User.findById(decoded.id).select('-password');
    } catch (dbError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  Database error in auth middleware, attempting Demo Mode fallback');
      } else {
        throw dbError;
      }
    }

    if (!user) {
      // If it's a demo token and we're in dev, create a mock user object
      if (decoded.isDemo && process.env.NODE_ENV === 'development') {
        user = {
          _id: decoded.id,
          role: decoded.role,
          name: 'Demo Guest',
          isActive: true,
          toPublicJSON: () => ({ _id: decoded.id, role: decoded.role, name: 'Demo Guest', isActive: true })
        };
      } else {
        return res.status(401).json({
          success: false,
          message: 'Token is valid but user no longer exists.'
        });
      }
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact support.'
      });
    }

    // Update last active timestamp (non-blocking)
    User.findByIdAndUpdate(user._id, {
      'stats.lastActive': Date.now()
    }).exec();

    // Attach user to request object
    req.user = user;
    next();

  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.'
    });
  }
};

/**
 * Role-based access control
 * Usage: authorize('admin')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route. Required: ${roles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
