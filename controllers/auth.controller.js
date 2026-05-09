/**
 * Auth Controller
 * Handles user registration, login, profile management
 */

const mongoose = require('mongoose');
const User = require('../models/User.model');
const { generateToken } = require('../utils/generateToken');

// Helper to check DB connection
const checkDB = (force = true) => {
  if (mongoose.connection.readyState !== 1) {
    if (!force && process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Database not connected, but continuing (non-critical path)');
      return false;
    }
    const error = new Error('Database connection is not ready. Please try again in a moment.');
    error.statusCode = 503;
    throw error;
  }
  return true;
};

// ========================
// @route  POST /api/auth/register
// @access Public
// ========================
const register = async (req, res, next) => {
  try {
    checkDB(true);
    const { name, email, password, role = 'jobseeker' } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: ['jobseeker', 'recruiter'].includes(role) ? role : 'jobseeker'
    });

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome aboard.',
      token,
      user: user.toPublicJSON()
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  POST /api/auth/login
// @access Public
// ========================
const login = async (req, res, next) => {
  try {
    checkDB(true);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user with password (select: false means we need to explicitly include it)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact support.'
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    // Update last active (non-blocking)
    User.findByIdAndUpdate(user._id, { 'stats.lastActive': Date.now() }).exec().catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: user.toPublicJSON()
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// ========================
// @route  POST /api/auth/guest-login
// @access Public
// ========================
const guestLogin = async (req, res, next) => {
  try {
    const { role = 'jobseeker' } = req.body;
    const isDBConnected = checkDB(false);

    if (!isDBConnected) {
      // Return a mock guest user if DB is down (Demo mode)
      const mockId = "00000000000000000000demo"; // 24 chars, valid hex-ish but recognized by our heuristic
      const mockUser = {
        _id: mockId,
        name: `Guest ${role.charAt(0).toUpperCase() + role.slice(1)} (Demo)`,
        email: `guest_${role}@demo.com`,
        role: role,
        isActive: true,
        toPublicJSON: () => ({
          _id: mockId,
          name: `Guest ${role.charAt(0).toUpperCase() + role.slice(1)} (Demo)`,
          email: `guest_${role}@demo.com`,
          role: role,
          isActive: true
        })
      };

      const token = generateToken(mockUser._id, mockUser.role);
      return res.status(200).json({
        success: true,
        message: `Welcome! You are in Demo Mode (Database unavailable).`,
        token,
        user: mockUser.toPublicJSON()
      });
    }

    const guestEmail = `guest_${role}@resumeforge.com`;
    const guestName = `Guest ${role.charAt(0).toUpperCase() + role.slice(1)}`;

    // Find or create guest user
    let user = await User.findOne({ email: guestEmail });

    if (!user) {
      // Create a random password for guest (though they'll log in via this endpoint)
      const randomPassword = Math.random().toString(36).slice(-10);
      user = await User.create({
        name: guestName,
        email: guestEmail,
        password: randomPassword,
        role: ['jobseeker', 'recruiter'].includes(role) ? role : 'jobseeker',
        isActive: true
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    // Update last active (non-blocking)
    User.findByIdAndUpdate(user._id, { 'stats.lastActive': Date.now() }).exec().catch(() => {});

    res.status(200).json({
      success: true,
      message: `Welcome, ${user.name}! You are logged in as a guest.`,
      token,
      user: user.toPublicJSON()
    });

  } catch (error) {
    next(error);
  }
};

// @route  GET /api/auth/me
// @access Private
// ========================
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: user.toPublicJSON() });
  } catch (error) {
    next(error);
  }
};

// ========================
// @route  PUT /api/auth/profile
// @access Private
// ========================
const updateProfile = async (req, res, next) => {
  try {
    const { name, profile, company } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (profile) updates.profile = { ...req.user.profile, ...profile };
    if (company && req.user.role === 'recruiter') {
      updates.company = { ...req.user.company, ...company };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toPublicJSON()
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  PUT /api/auth/change-password
// @access Private
// ========================
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isCorrect = await user.comparePassword(currentPassword);

    if (!isCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Password changed successfully',
      token
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, guestLogin, getMe, updateProfile, changePassword };
