/**
 * Dashboard Controller
 * Analytics and statistics for user dashboard
 */

const User = require('../models/User.model');
const Resume = require('../models/Resume.model');
const Analysis = require('../models/Analysis.model');
const Interview = require('../models/Interview.model');
const Feedback = require('../models/Feedback.model');

// ========================
// @route  GET /api/dashboard/stats
// @access Private
// ========================
const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Parallel queries for performance
    const [
      totalResumes,
      totalAnalyses,
      totalInterviews,
      latestAnalysis,
      recentResumes,
      recentInterviews,
      atsScoreHistory
    ] = await Promise.all([
      Resume.countDocuments({ user: userId, isActive: true }),
      Analysis.countDocuments({ user: userId }),
      Interview.countDocuments({ user: userId, status: 'completed' }),
      Analysis.findOne({ user: userId }).sort({ createdAt: -1 }).populate('resume', 'title'),
      Resume.find({ user: userId, isActive: true }).sort({ createdAt: -1 }).limit(5).select('title atsScore createdAt'),
      Interview.find({ user: userId, status: 'completed' }).sort({ createdAt: -1 }).limit(5).select('title overallScore completedAt jobTitle'),
      Analysis.find({ user: userId }).sort({ createdAt: -1 }).limit(10).select('atsScore createdAt')
    ]);

    // Calculate average ATS score
    const avgScoreResult = await Analysis.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, avg: { $avg: '$atsScore' }, max: { $max: '$atsScore' } } }
    ]);

    const avgScore = avgScoreResult[0]?.avg ? Math.round(avgScoreResult[0].avg) : 0;
    const maxScore = avgScoreResult[0]?.max || 0;

    // ATS score trend (last 10 analyses)
    const scoreTrend = atsScoreHistory.map(a => ({
      date: a.createdAt,
      score: a.atsScore
    }));

    // Skills frequency from resumes
    const skillsData = await Resume.aggregate([
      { $match: { user: userId, isActive: true } },
      { $unwind: '$parsedData.skills' },
      { $group: { _id: '$parsedData.skills', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      stats: {
        overview: {
          totalResumes,
          totalAnalyses,
          totalInterviews,
          avgAtsScore: avgScore,
          maxAtsScore: maxScore,
          profileCompletion: calculateProfileCompletion(req.user)
        },
        latestAnalysis: latestAnalysis ? {
          score: latestAnalysis.atsScore,
          date: latestAnalysis.createdAt,
          resumeTitle: latestAnalysis.resume?.title,
          strengths: latestAnalysis.strengths?.slice(0, 3),
          suggestions: latestAnalysis.suggestions?.slice(0, 3)
        } : null,
        recentResumes,
        recentInterviews,
        scoreTrend,
        topSkills: skillsData.map(s => ({ skill: s._id, count: s.count })),
        quickActions: [
          { label: 'Upload Resume', link: '/upload', done: totalResumes > 0 },
          { label: 'Analyze Resume', link: '/analysis', done: totalAnalyses > 0 },
          { label: 'Practice Interview', link: '/interview', done: totalInterviews > 0 }
        ]
      }
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  GET /api/dashboard/admin
// @access Private (Admin)
// ========================
const getAdminStats = async (req, res, next) => {
  try {
    const [totalUsers, totalResumes, totalAnalyses, totalInterviews, totalFeedback] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Resume.countDocuments({ isActive: true }),
      Analysis.countDocuments(),
      Interview.countDocuments(),
      Feedback.countDocuments()
    ]);

    // New users this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: weekAgo } });

    // User growth over last 7 days
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Average ATS score globally
    const globalAvgScore = await Analysis.aggregate([
      { $group: { _id: null, avg: { $avg: '$atsScore' } } }
    ]);

    res.json({
      success: true,
      adminStats: {
        totalUsers,
        totalResumes,
        totalAnalyses,
        totalInterviews,
        totalFeedback,
        newUsersThisWeek,
        globalAvgAtsScore: globalAvgScore[0]?.avg ? Math.round(globalAvgScore[0].avg) : 0,
        userGrowth
      }
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// Helper: Profile Completion Score
// ========================
const calculateProfileCompletion = (user) => {
  let score = 20; // Base (registered)
  const p = user.profile || {};

  if (p.phone) score += 10;
  if (p.location) score += 10;
  if (p.bio) score += 15;
  if (p.skills && p.skills.length > 0) score += 15;
  if (p.linkedIn) score += 10;
  if (p.github) score += 10;
  if (p.avatar) score += 10;

  return Math.min(score, 100);
};

module.exports = { getDashboardStats, getAdminStats };
