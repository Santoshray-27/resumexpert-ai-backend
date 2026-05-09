/**
 * User Model
 * Handles job seekers with JWT authentication
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },

  // Role: jobseeker | admin
  role: {
    type: String,
    enum: ['jobseeker', 'admin'],
    default: 'jobseeker'
  },

  // Profile Details
  profile: {
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    bio: { type: String, default: '' },
    linkedIn: { type: String, default: '' },
    github: { type: String, default: '' },
    portfolio: { type: String, default: '' },
    targetRole: { type: String, default: '' },
    experience: { type: Number, default: 0 }, // years
    skills: [{ type: String }]
  },


  // Statistics
  stats: {
    resumesUploaded: { type: Number, default: 0 },
    analysisCount: { type: Number, default: 0 },
    interviewsCompleted: { type: Number, default: 0 },
    averageAtsScore: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
  },

  // Auth & Security
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  passwordResetToken: String,
  passwordResetExpires: Date,

  // Timestamps
}, { timestamps: true });

// ========================
// Pre-save Middleware: Hash password
// ========================
userSchema.pre('save', async function (next) {
  // Only hash if password is modified
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ========================
// Instance Methods
// ========================

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get public profile (remove sensitive data)
userSchema.methods.toPublicJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  return user;
};

// ========================
// Indexes for Performance
// ========================
// userSchema.index({ email: 1 }); // Handled by unique: true in schema definition
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
