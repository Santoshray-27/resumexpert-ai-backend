/**
 * Resume Controller
 * Handles resume upload, parsing, retrieval, and management
 */

const path = require('path');
const fs = require('fs');
const Resume = require('../models/Resume.model');
const User = require('../models/User.model');
const { parseResume } = require('../utils/resumeParser');

// ========================
// @route  POST /api/resumes/upload
// @access Private
// ========================
const uploadResume = async (req, res, next) => {
  try {
    const file = req.file;
    const { title } = req.body;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

    // Create resume record first
    const resume = await Resume.create({
      user: req.user._id,
      title: title || `Resume - ${new Date().toLocaleDateString()}`,
      fileName: file.filename,
      originalName: file.originalname,
      fileType: ext === 'doc' ? 'doc' : ext,
      fileSize: file.size,
      filePath: file.path,
      fileUrl: `/uploads/${req.user._id}/${file.filename}`,
      status: 'parsing'
    });

    // Parse resume asynchronously
    try {
      const parsed = await parseResume(file.path);

      await Resume.findByIdAndUpdate(resume._id, {
        rawText: parsed.rawText,
        parsedData: parsed.parsedData,
        status: 'parsed'
      });

      // Update user stats
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'stats.resumesUploaded': 1 }
      });

      const updatedResume = await Resume.findById(resume._id);

      res.status(201).json({
        success: true,
        message: 'Resume uploaded and parsed successfully!',
        resume: updatedResume
      });

    } catch (parseError) {
      // Parsing failed but file is saved
      await Resume.findByIdAndUpdate(resume._id, {
        status: 'error',
        rawText: ''
      });

      res.status(201).json({
        success: true,
        message: 'Resume uploaded. Text extraction had issues - some features may be limited.',
        resume: await Resume.findById(resume._id),
        warning: parseError.message
      });
    }

  } catch (error) {
    // Clean up uploaded file if database save fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

// ========================
// @route  GET /api/resumes
// @access Private
// ========================
const getMyResumes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Resume.countDocuments({ user: req.user._id, isActive: true });
    const resumes = await Resume.find({ user: req.user._id, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('latestAnalysis', 'atsScore createdAt');

    res.json({
      success: true,
      count: resumes.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      resumes
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  GET /api/resumes/:id
// @access Private
// ========================
const getResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('latestAnalysis');

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    // Increment view count
    await Resume.findByIdAndUpdate(resume._id, { $inc: { viewCount: 1 } });

    res.json({ success: true, resume });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  PUT /api/resumes/:id
// @access Private
// ========================
const updateResume = async (req, res, next) => {
  try {
    const { title, isPrimary } = req.body;

    const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    // If setting as primary, unset all others
    if (isPrimary) {
      await Resume.updateMany({ user: req.user._id }, { isPrimary: false });
    }

    const updates = {};
    if (title) updates.title = title;
    if (isPrimary !== undefined) updates.isPrimary = isPrimary;

    const updated = await Resume.findByIdAndUpdate(resume._id, updates, { new: true });

    res.json({ success: true, message: 'Resume updated', resume: updated });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  DELETE /api/resumes/:id
// @access Private
// ========================
const deleteResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    // Delete actual file
    if (fs.existsSync(resume.filePath)) {
      fs.unlinkSync(resume.filePath);
    }

    await Resume.findByIdAndDelete(resume._id);

    res.json({ success: true, message: 'Resume deleted successfully' });

  } catch (error) {
    next(error);
  }
};

module.exports = { uploadResume, getMyResumes, getResume, updateResume, deleteResume };
