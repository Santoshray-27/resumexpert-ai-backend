/**
 * JWT Token Generator
 * Creates signed JWT tokens for authentication
 */

const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for a user
 * @param {string} userId - MongoDB user ID
 * @param {string} role - User role (jobseeker/admin)
 * @returns {string} Signed JWT token
 */
const generateToken = (userId, role = 'jobseeker') => {
  return jwt.sign(
    {
      id: userId,
      role,
      isDemo: userId.toString().includes('demo') || userId.toString().startsWith('0000')
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'resumexpert-ai',
      audience: 'resumexpert-ai-api'
    }
  );
};

module.exports = { generateToken };
