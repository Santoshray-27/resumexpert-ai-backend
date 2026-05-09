/**
 * Job Controller
 * Job recommendations, listings, and AI matching
 */

const Job = require('../models/Job.model');
const Resume = require('../models/Resume.model');
const { getJobRecommendations } = require('../utils/aiService');
const { searchRealJobs } = require('../utils/jobAggregator');

// ========================
// @route  GET /api/jobs/recommendations
// @access Private
// ========================
const getRecommendations = async (req, res, next) => {
  try {
    // Get user's primary or latest resume
    const resume = await Resume.findOne({
      user: req.user._id,
      isActive: true
    }).sort({ isPrimary: -1, createdAt: -1 });

    if (!resume || !resume.parsedData) {
      // Return default recommendations if no resume
      const defaultJobs = await getJobRecommendations({ skills: [] });
      return res.json({
        success: true,
        message: 'Upload a resume for personalized recommendations',
        jobs: defaultJobs,
        source: 'default'
      });
    }

    const recommendations = await getJobRecommendations(resume.parsedData);

    res.json({
      success: true,
      count: recommendations.length,
      jobs: recommendations,
      source: 'ai',
      basedOn: {
        resume: resume.title,
        skills: resume.parsedData.skills?.slice(0, 5) || []
      }
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  GET /api/jobs
// @access Public
// ========================
const getJobs = async (req, res, next) => {
  try {
    const {
      search, location, type, experience, salary,
      page = 1, limit = 12, sort = '-createdAt'
    } = req.query;

    const query = { isActive: true };

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Filters
    if (location) query['location.city'] = new RegExp(location, 'i');
    if (type) query.employmentType = type;
    if (experience) query.minimumExperience = { $lte: parseInt(experience) };

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select('-description -requirements -responsibilities');

    res.json({
      success: true,
      count: jobs.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      jobs
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  GET /api/jobs/:id
// @access Public
// ========================
const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate('postedBy', 'name company');

    if (!job || !job.isActive) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Increment views
    await Job.findByIdAndUpdate(job._id, { $inc: { viewCount: 1 } });

    res.json({ success: true, job });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  POST /api/jobs
// @access Private (Recruiter)
// ========================
const createJob = async (req, res, next) => {
  try {
    const job = await Job.create({
      ...req.body,
      postedBy: req.user._id,
      source: 'manual'
    });

    res.status(201).json({ success: true, message: 'Job posted successfully', job });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  PUT /api/jobs/:id
// @access Private (Recruiter/Admin)
// ========================
const updateJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, postedBy: req.user._id });

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or unauthorized' });
    }

    const updated = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });

    res.json({ success: true, message: 'Job updated', job: updated });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  DELETE /api/jobs/:id
// @access Private (Recruiter)
// ========================
const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, postedBy: req.user._id });

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or unauthorized' });
    }

    await Job.findByIdAndUpdate(req.params.id, { isActive: false });

    res.json({ success: true, message: 'Job removed successfully' });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  POST /api/jobs/search
// @access Private
// ========================
const searchJobs = async (req, res, next) => {
  try {
    const {
      query = '',
      location = '',
      employmentType = '',
      datePosted = 'all',
      source = '',
      resumeId
    } = req.body;

    let searchQuery = query;

    // Auto-extract skills/query from resume if provided
    if (resumeId) {
      const resume = await Resume.findOne({ _id: resumeId, user: req.user._id });
      if (resume && resume.parsedData) {
        const skills = resume.parsedData.skills || [];
        const topSkills = skills.slice(0, 3).join(' ');
        searchQuery = query ? `${query} ${topSkills}` : topSkills;
      }
    }

    if (!searchQuery) {
      searchQuery = 'Software Engineer'; // Default
    }

    let results = await searchRealJobs(
      source ? `${searchQuery} ${source}` : searchQuery, 
      location, 
      employmentType, 
      datePosted,
      source
    );

    // Apply strict source filter if provided to ensure UI consistency
    if (source) {
      results = results.filter(job => job.source && job.source.toLowerCase().includes(source.toLowerCase()));
    }

    // Sort by match score natively
    const sorted = results.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      count: sorted.length,
      jobs: sorted,
      source: 'aggregator'
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { getRecommendations, getJobs, getJob, createJob, updateJob, deleteJob, searchJobs };
