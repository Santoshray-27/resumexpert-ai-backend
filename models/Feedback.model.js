/**
 * Feedback Model
 * User feedback on platform features and resume reviews
 */

const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  // Who submitted
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // What it's about
  type: {
    type: String,
    enum: ['platform', 'resume-review', 'analysis', 'interview', 'feature-request', 'bug-report', 'other'],
    required: true
  },

  // Reference (optional)
  relatedTo: {
    resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
    analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis' },
    interview: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview' },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }
  },

  // Feedback Content
  title: {
    type: String,
    required: [true, 'Feedback title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Feedback message is required'],
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },

  // Rating
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },

  // Category for organization
  category: {
    type: String,
    enum: ['positive', 'negative', 'neutral', 'suggestion'],
    default: 'neutral'
  },

  // Status (for admin management)
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'closed'],
    default: 'pending'
  },

  // Admin Response
  adminResponse: {
    message: { type: String, default: '' },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    respondedAt: { type: Date }
  },

  // Visibility
  isPublic: { type: Boolean, default: false },
  isAnonymous: { type: Boolean, default: false },

}, { timestamps: true });

// Indexes
feedbackSchema.index({ user: 1, createdAt: -1 });
feedbackSchema.index({ type: 1, status: 1 });
feedbackSchema.index({ rating: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
