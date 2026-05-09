/**
 * Interview Model
 * Stores AI-generated interview sessions, questions, and evaluations
 */

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  type: {
    type: String,
    enum: ['behavioral', 'technical', 'situational', 'cultural', 'roleplay'],
    default: 'behavioral'
  },
  questionFormat: {
    type: String,
    enum: ['open-ended', 'mcq'],
    default: 'open-ended'
  },
  options: [{ type: String }],
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  expectedAnswer: { type: String, default: '' },    // Model answer
  userAnswer: { type: String, default: '' },         // User's response
  evaluation: {
    score: { type: Number, min: 0, max: 10, default: null },
    feedback: { type: String, default: '' },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
    modelAnswer: { type: String, default: '' }
  },
  isAnswered: { type: Boolean, default: false },
  timeSpent: { type: Number, default: 0 } // seconds
}, { _id: true });

const interviewSchema = new mongoose.Schema({
  // References
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  resume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume'
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },

  // Interview Setup
  title: {
    type: String,
    default: 'Interview Session'
  },
  jobTitle: { type: String, default: '' },
  company: { type: String, default: '' },
  industry: { type: String, default: '' },
  experienceLevel: {
    type: String,
    enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'manager'],
    default: 'mid'
  },
  interviewType: {
    type: String,
    enum: ['technical', 'behavioral', 'mixed', 'case-study', 'mcq-only'],
    default: 'mixed'
  },

  // Questions & Answers
  questions: [questionSchema],
  totalQuestions: { type: Number, default: 0 },
  answeredQuestions: { type: Number, default: 0 },

  // Overall Scores
  overallScore: { type: Number, min: 0, max: 100, default: null },
  scoreBreakdown: {
    communication: { type: Number, default: 0 },
    technical: { type: Number, default: 0 },
    problemSolving: { type: Number, default: 0 },
    culturalFit: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 }
  },

  // Overall Feedback
  overallFeedback: { type: String, default: '' },
  topStrengths: [{ type: String }],
  areasToImprove: [{ type: String }],
  readinessLevel: {
    type: String,
    enum: ['not-ready', 'needs-practice', 'good', 'excellent'],
    default: 'needs-practice'
  },

  // Session Metadata
  status: {
    type: String,
    enum: ['draft', 'in-progress', 'completed', 'abandoned'],
    default: 'draft'
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  duration: { type: Number, default: 0 }, // seconds

  // AI Model Used
  aiModel: {
    type: String,
    enum: ['gemini', 'openai', 'groq', 'mock'],
    default: 'mock'
  },

}, { timestamps: true });

// Indexes
interviewSchema.index({ user: 1, createdAt: -1 });
interviewSchema.index({ user: 1, status: 1 });

const Interview = mongoose.model('Interview', interviewSchema);

module.exports = Interview;
