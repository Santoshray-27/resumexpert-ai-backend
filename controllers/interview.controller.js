/**
 * Interview Controller
 * AI interview session management and answer evaluation
 */

const Interview = require('../models/Interview.model');
const Resume = require('../models/Resume.model');
const User = require('../models/User.model');
const { generateInterviewQuestions, evaluateInterviewAnswer } = require('../utils/aiService');

// ========================
// @route  POST /api/interviews/create
// @access Private
// ========================
const createSession = async (req, res, next) => {
  try {
    const {
      jobTitle,
      company = '',
      industry = '',
      experienceLevel = 'mid',
      interviewType = 'mixed',
      questionCount = 10,
      resumeId
    } = req.body;

    if (!jobTitle) {
      return res.status(400).json({ success: false, message: 'Job title is required' });
    }

    // Get skills from resume if provided
    let skills = [];
    if (resumeId) {
      const resume = await Resume.findOne({ _id: resumeId, user: req.user._id });
      if (resume && resume.parsedData?.skills) {
        skills = resume.parsedData.skills;
      }
    }

    // Generate questions via AI
    const generatedQuestions = await generateInterviewQuestions(
      jobTitle, skills, experienceLevel, questionCount, interviewType
    );

    // Create interview session
    const interview = await Interview.create({
      user: req.user._id,
      resume: resumeId || null,
      title: `${jobTitle} Interview at ${company || 'Practice Session'}`,
      jobTitle,
      company,
      industry,
      experienceLevel,
      interviewType,
      questions: generatedQuestions.map(q => ({
        question: q.question,
        questionFormat: q.format === 'mcq' ? 'mcq' : 'open-ended',
        options: q.options || [],
        type: q.type || 'behavioral',
        difficulty: q.difficulty || 'medium',
        expectedAnswer: q.expectedAnswer || '',
        userAnswer: '',
        isAnswered: false
      })),
      totalQuestions: generatedQuestions.length,
      status: 'in-progress',
      startedAt: new Date(),
      aiModel: 'gemini' // Use valid enum value
    });

    res.status(201).json({
      success: true,
      message: 'Interview session created successfully!',
      interview
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  POST /api/interviews/:id/answer
// @access Private
// ========================
const submitAnswer = async (req, res, next) => {
  try {
    const { questionIndex, answer } = req.body;
    const interviewId = req.params.id;

    if (questionIndex === undefined || !answer) {
      return res.status(400).json({ success: false, message: 'Question index and answer are required' });
    }

    const interview = await Interview.findOne({ _id: interviewId, user: req.user._id });
    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview session not found' });
    }

    if (questionIndex >= interview.questions.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    const question = interview.questions[questionIndex];

    // Evaluate answer with AI
    const evaluation = await evaluateInterviewAnswer(
      question.question,
      answer,
      interview.jobTitle,
      question.expectedAnswer,
      question.questionFormat
    );

    // Update the specific question
    interview.aiModel = evaluation.aiModel || interview.aiModel; // Track latest model used
    interview.questions[questionIndex].userAnswer = answer;
    interview.questions[questionIndex].isAnswered = true;
    interview.questions[questionIndex].evaluation = {
      score: evaluation.score,
      feedback: evaluation.feedback,
      strengths: evaluation.strengths || [],
      improvements: evaluation.improvements || [],
      modelAnswer: evaluation.modelAnswer || ''
    };

    // Count answered questions
    interview.answeredQuestions = interview.questions.filter(q => q.isAnswered).length;

    await interview.save();

    res.json({
      success: true,
      message: 'Answer submitted and evaluated!',
      evaluation: interview.questions[questionIndex].evaluation,
      answeredCount: interview.answeredQuestions,
      totalCount: interview.totalQuestions
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  POST /api/interviews/:id/complete
// @access Private
// ========================
const completeSession = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });

    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview session not found' });
    }

    // Calculate overall score
    const answeredQuestions = interview.questions.filter(q => q.isAnswered && q.evaluation?.score !== null);
    const totalScore = answeredQuestions.reduce((sum, q) => sum + (q.evaluation?.score || 0), 0);
    const overallScore = answeredQuestions.length > 0
      ? Math.round((totalScore / answeredQuestions.length) * 10)
      : 0;

    // Determine readiness
    let readinessLevel = 'not-ready';
    if (overallScore >= 80) readinessLevel = 'excellent';
    else if (overallScore >= 65) readinessLevel = 'good';
    else if (overallScore >= 45) readinessLevel = 'needs-practice';

    // Aggregate top strengths and improvements
    const allStrengths = answeredQuestions.flatMap(q => q.evaluation?.strengths || []);
    const allImprovements = answeredQuestions.flatMap(q => q.evaluation?.improvements || []);

    // Update interview
    interview.status = 'completed';
    interview.completedAt = new Date();
    interview.overallScore = overallScore;
    interview.readinessLevel = readinessLevel;
    interview.answeredQuestions = interview.questions.filter(q => q.isAnswered).length;
    interview.topStrengths = [...new Set(allStrengths)].slice(0, 5);
    interview.areasToImprove = [...new Set(allImprovements)].slice(0, 5);
    interview.overallFeedback = `You completed ${interview.answeredQuestions} of ${interview.totalQuestions} questions with an overall score of ${overallScore}/100. ${readinessLevel === 'excellent' ? 'Excellent performance!' : readinessLevel === 'good' ? 'Good performance with room to grow.' : 'Keep practicing to improve your interview skills.'}`;

    if (interview.startedAt) {
      interview.duration = Math.round((new Date() - interview.startedAt) / 1000);
    }

    await interview.save();

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.interviewsCompleted': 1 }
    });

    res.json({
      success: true,
      message: 'Interview session completed!',
      summary: {
        overallScore,
        readinessLevel,
        answeredQuestions: interview.answeredQuestions,
        totalQuestions: interview.totalQuestions,
        topStrengths: interview.topStrengths,
        areasToImprove: interview.areasToImprove,
        overallFeedback: interview.overallFeedback,
        duration: interview.duration
      },
      interview
    });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  GET /api/interviews
// @access Private
// ========================
const getMyInterviews = async (req, res, next) => {
  try {
    const interviews = await Interview.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('-questions.evaluation.modelAnswer') // Trim large data
      .limit(20);

    res.json({ success: true, count: interviews.length, interviews });

  } catch (error) {
    next(error);
  }
};

// ========================
// @route  GET /api/interviews/:id
// @access Private
// ========================
const getInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });

    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    res.json({ success: true, interview });

  } catch (error) {
    next(error);
  }
};

module.exports = { createSession, submitAnswer, completeSession, getMyInterviews, getInterview };
