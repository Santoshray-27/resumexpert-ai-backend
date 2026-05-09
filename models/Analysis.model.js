/**
 * Analysis Model
 * Stores AI analysis results for resumes
 */

const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  // References
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  resume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    required: true,
    index: true
  },

  // Core ATS Score
  atsScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },

  // Score Breakdown
  scoreBreakdown: {
    formatting: { type: Number, default: 0 },     // Layout, readability
    keywords: { type: Number, default: 0 },        // Keyword density
    experience: { type: Number, default: 0 },      // Experience relevance
    skills: { type: Number, default: 0 },          // Skills match
    education: { type: Number, default: 0 },       // Education scoring
    overall: { type: Number, default: 0 }          // Overall quality
  },

  // AI Analysis Results
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  missingSkills: [{ type: String }],
  suggestions: [{ type: String }],

  // Detailed Feedback
  sectionFeedback: {
    summary: { type: String, default: '' },
    experience: { type: String, default: '' },
    skills: { type: String, default: '' },
    education: { type: String, default: '' },
    formatting: { type: String, default: '' }
  },

  // Keyword Analysis
  keywordsFound: [{ type: String }],
  keywordsMissing: [{ type: String }],
  keywordDensity: { type: Number, default: 0 }, // percentage

  // Industry & Role Targeting
  targetJobTitle: { type: String, default: '' },
  industryMatch: { type: Number, default: 0 }, // percentage
  industryKeywords: [{ type: String }],

  // Competitor Comparison
  percentilRank: { type: Number, default: 0 }, // vs other resumes

  // AI Model Used
  aiModel: {
    type: String,
    enum: ['gemini', 'openai', 'groq', 'mock'],
    default: 'mock'
  },

  // Processing Info
  processingTime: { type: Number, default: 0 }, // ms
  tokensUsed: { type: Number, default: 0 },

  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'completed'
  },
  errorMessage: { type: String, default: '' },

}, { timestamps: true });

// Indexes
analysisSchema.index({ user: 1, createdAt: -1 });
analysisSchema.index({ resume: 1, createdAt: -1 });
analysisSchema.index({ atsScore: -1 });

const Analysis = mongoose.model('Analysis', analysisSchema);

module.exports = Analysis;
