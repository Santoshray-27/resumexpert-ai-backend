/**
 * Job Model
 * Job listings for recommendation system
 */

const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  // Job Details
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    index: true
  },
  company: {
    name: { type: String, required: true },
    logo: { type: String, default: '' },
    website: { type: String, default: '' },
    size: { type: String, default: '' },
    industry: { type: String, default: '' }
  },
  description: {
    type: String,
    required: [true, 'Job description is required']
  },
  requirements: [{ type: String }],
  responsibilities: [{ type: String }],

  // Skills & Qualifications
  requiredSkills: [{ type: String }],
  preferredSkills: [{ type: String }],
  minimumExperience: { type: Number, default: 0 }, // years
  educationLevel: { type: String, default: '' },

  // Location & Type
  location: {
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: 'US' },
    isRemote: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['onsite', 'remote', 'hybrid'],
      default: 'onsite'
    }
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'freelance', 'internship'],
    default: 'full-time'
  },

  // Compensation
  salary: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    period: { type: String, default: 'yearly' }
  },

  // Categories
  category: { type: String, default: '' },
  industry: { type: String, default: '' },
  tags: [{ type: String }],



  // Status & Metrics
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  applicationCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  deadline: { type: Date },

  // External Source
  source: {
    type: String,
    enum: ['manual', 'linkedin', 'indeed', 'glassdoor', 'ai-generated'],
    default: 'manual'
  },
  externalId: { type: String, default: '' },
  externalUrl: { type: String, default: '' },

}, { timestamps: true });

// Full-text search index
jobSchema.index({ title: 'text', description: 'text', 'company.name': 'text' });
jobSchema.index({ isActive: 1, createdAt: -1 });
jobSchema.index({ requiredSkills: 1 });
jobSchema.index({ category: 1 });

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
