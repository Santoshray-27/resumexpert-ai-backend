/**
 * Analysis Controller
 * AI-powered resume analysis endpoints
 */

const Resume = require('../models/Resume.model');
const Analysis = require('../models/Analysis.model');
const User = require('../models/User.model');
const { analyzeResume } = require('../utils/aiService');

// ========================
// @route  POST /api/analysis/analyze/:resumeId
// @access Private
// ========================
const analyzeResumeController = async (req, res, next) => {
  try {
    const { resumeId } = req.params;
    const { jobTitle, jobDescription } = req.body;

    // Get resume
    const resume = await Resume.findOne({ _id: resumeId, user: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    if (!resume.rawText || resume.rawText.length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Resume text is too short or could not be extracted. Please re-upload.'
      });
    }

    // Run AI analysis
    const analysisResult = await analyzeResume(resume.rawText, jobTitle, jobDescription);

    // Save analysis to database
    const analysis = await Analysis.create({
      user: req.user._id,
      resume: resume._id,
      atsScore: analysisResult.atsScore,
      scoreBreakdown: analysisResult.scoreBreakdown,
      strengths: analysisResult.strengths,
      weaknesses: analysisResult.weaknesses,
      missingSkills: analysisResult.missingSkills,
      suggestions: analysisResult.suggestions,
      sectionFeedback: analysisResult.sectionFeedback,
      keywordsFound: analysisResult.keywordsFound,
      keywordsMissing: analysisResult.keywordsMissing,
      keywordDensity: analysisResult.keywordDensity,
      industryMatch: analysisResult.industryMatch,
      targetJobTitle: jobTitle || '',
      aiModel: analysisResult.aiModel || 'mock',
      processingTime: analysisResult.processingTime || 0,
      status: 'completed'
    });

    // Update resume with latest analysis reference and ATS score
    await Resume.findByIdAndUpdate(resume._id, {
      latestAnalysis: analysis._id,
      atsScore: analysis.atsScore,
      status: 'analyzed'
    });

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.analysisCount': 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Resume analyzed successfully!',
      analysis
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  GET /api/analysis/resume/:resumeId
// @access Private
// ========================
const getAnalysisForResume = async (req, res, next) => {
  try {
    const analyses = await Analysis.find({
      resume: req.params.resumeId,
      user: req.user._id
    }).sort({ createdAt: -1 }).limit(10);

    res.json({ success: true, count: analyses.length, analyses });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  GET /api/analysis/:id
// @access Private
// ========================
const getAnalysis = async (req, res, next) => {
  try {
    const analysis = await Analysis.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('resume', 'title originalName fileType');

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    res.json({ success: true, analysis });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  GET /api/analysis/my/all
// @access Private
// ========================
const getAllMyAnalyses = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const total = await Analysis.countDocuments({ user: req.user._id });
    const analyses = await Analysis.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('resume', 'title originalName');

    const avgScore = await Analysis.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: null, avg: { $avg: '$atsScore' } } }
    ]);

    res.json({
      success: true,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      averageScore: avgScore[0]?.avg ? Math.round(avgScore[0].avg) : 0,
      analyses
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeResumeController,
  getAnalysisForResume,
  getAnalysis,
  getAllMyAnalyses
};
