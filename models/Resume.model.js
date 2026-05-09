/**
 * Resume Model
 * Stores uploaded resume metadata and extracted content
 */

const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  // Owner reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // File Details
  title: {
    type: String,
    required: [true, 'Resume title is required'],
    trim: true,
    default: 'My Resume'
  },
  fileName: { type: String, required: true },
  originalName: { type: String, required: true },
  fileType: {
    type: String,
    enum: ['pdf', 'docx', 'doc'],
    required: true
  },
  fileSize: { type: Number, required: true }, // in bytes
  filePath: { type: String, required: true },
  fileUrl: { type: String, default: '' },

  // Extracted Text Content
  rawText: { type: String, default: '' },

  // Parsed Data (structured extraction)
  parsedData: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    summary: { type: String, default: '' },
    skills: [{ type: String }],
    experience: [{
      company: String,
      role: String,
      duration: String,
      description: String,
      startDate: String,
      endDate: String
    }],
    education: [{
      institution: String,
      degree: String,
      field: String,
      year: String,
      gpa: String
    }],
    certifications: [{ type: String }],
    languages: [{ type: String }],
    links: {
      linkedin: String,
      github: String,
      portfolio: String
    }
  },

  // Analysis reference
  latestAnalysis: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Analysis'
  },
  atsScore: { type: Number, default: null },

  // Status
  status: {
    type: String,
    enum: ['uploaded', 'parsing', 'parsed', 'analyzed', 'error'],
    default: 'uploaded'
  },
  isActive: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false }, // User's main resume

  // Metadata
  uploadCount: { type: Number, default: 1 },
  viewCount: { type: Number, default: 0 },
  downloadCount: { type: Number, default: 0 },

}, { timestamps: true });

// Indexes
resumeSchema.index({ user: 1, createdAt: -1 });
resumeSchema.index({ user: 1, isPrimary: 1 });
resumeSchema.index({ atsScore: -1 });

const Resume = mongoose.model('Resume', resumeSchema);

module.exports = Resume;
