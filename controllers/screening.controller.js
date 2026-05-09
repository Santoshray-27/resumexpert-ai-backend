/**
 * Screening Controller
 * AI-powered resume screening and skill gap analysis endpoints
 */

const mongoose = require('mongoose');
const Resume = require('../models/Resume.model');
const User = require('../models/User.model');
const { screenResume, analyzeSkillGap } = require('../utils/aiService');

// Helper to check DB connection
const checkDB = () => {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('Database connection is not ready. Please try again in a moment.');
    error.statusCode = 503;
    throw error;
  }
};

// ========================
// @route  POST /api/screening/screen
// @desc   Screen a resume against a job description
// @access Private
// ========================
const screenResumeController = async (req, res, next) => {
  try {
    checkDB();
    const { resumeId, jobTitle, jobDescription, requiredSkills } = req.body;

    if (!jobTitle || !jobDescription) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both job title and job description'
      });
    }

    let resumeText = '';

    // If resumeId is provided, use the stored resume
    if (resumeId) {
      const resume = await Resume.findOne({ _id: resumeId, user: req.user._id });
      if (!resume) {
        return res.status(404).json({ success: false, message: 'Resume not found' });
      }
      if (!resume.rawText || resume.rawText.length < 50) {
        return res.status(400).json({
          success: false,
          message: 'Resume text is too short. Please re-upload your resume.'
        });
      }
      resumeText = resume.rawText;
    } else if (req.body.resumeText) {
      // Manual text input for screening without uploaded resume
      resumeText = req.body.resumeText;
    } else {
      // Try to use the user's latest resume
      const latestResume = await Resume.findOne({ user: req.user._id, isActive: true })
        .sort({ createdAt: -1 });
      if (!latestResume || !latestResume.rawText) {
        return res.status(400).json({
          success: false,
          message: 'No resume found. Please upload a resume first or provide resume text.'
        });
      }
      resumeText = latestResume.rawText;
    }

    // Run AI screening
    const result = await screenResume(
      resumeText,
      jobTitle,
      jobDescription,
      Array.isArray(requiredSkills) ? requiredSkills : []
    );

    res.json({
      success: true,
      message: 'Resume screening completed!',
      screening: result
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  POST /api/screening/skill-gap
// @desc   Analyze skill gaps for a target role
// @access Private
// ========================
const skillGapController = async (req, res, next) => {
  try {
    checkDB();
    const { resumeId, targetRole, experienceLevel, currentSkills } = req.body;

    if (!targetRole) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a target role'
      });
    }

    let resumeText = '';
    let skills = currentSkills || [];

    // If resumeId is provided, use that resume's data
    if (resumeId) {
      const resume = await Resume.findOne({ _id: resumeId, user: req.user._id });
      if (!resume) {
        return res.status(404).json({ success: false, message: 'Resume not found' });
      }
      resumeText = resume.rawText || '';
      if (resume.parsedData?.skills?.length > 0 && skills.length === 0) {
        skills = resume.parsedData.skills;
      }
    } else {
      // Try to use the user's latest resume
      const latestResume = await Resume.findOne({ user: req.user._id, isActive: true })
        .sort({ createdAt: -1 });
      if (latestResume) {
        resumeText = latestResume.rawText || '';
        if (latestResume.parsedData?.skills?.length > 0 && skills.length === 0) {
          skills = latestResume.parsedData.skills;
        }
      }
    }

    // Also pull skills from user profile if none found
    if (skills.length === 0 && req.user.profile?.skills?.length > 0) {
      skills = req.user.profile.skills;
    }

    // Run AI skill gap analysis
    const result = await analyzeSkillGap(
      resumeText,
      skills,
      targetRole,
      experienceLevel || 'mid'
    );

    res.json({
      success: true,
      message: 'Skill gap analysis completed!',
      skillGap: result
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  GET /api/screening/resumes
// @desc   Get user's resumes for selection
// @access Private
// ========================
const getUserResumes = async (req, res, next) => {
  try {
    checkDB();
    const resumes = await Resume.find({ user: req.user._id, isActive: true })
      .select('title originalName fileType atsScore parsedData.skills createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, resumes });
  } catch (error) {
    next(error);
  }
};

module.exports = { screenResumeController, skillGapController, getUserResumes };
