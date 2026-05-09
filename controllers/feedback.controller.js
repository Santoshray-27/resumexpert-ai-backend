/**
 * Feedback Controller
 * User feedback submission and management
 */

const Feedback = require('../models/Feedback.model');

// @route  POST /api/feedback
const createFeedback = async (req, res, next) => {
  try {
    const { type, title, message, rating, category, relatedTo, isAnonymous } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({ success: false, message: 'Type, title, and message are required' });
    }

    const feedback = await Feedback.create({
      user: req.user._id,
      type,
      title,
      message,
      rating: rating || null,
      category: category || 'neutral',
      relatedTo: relatedTo || {},
      isAnonymous: isAnonymous || false
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! We appreciate it.',
      feedback
    });

  } catch (error) {
    next(error);
  }
};

// @route  GET /api/feedback/my
const getMyFeedback = async (req, res, next) => {
  try {
    const feedbacks = await Feedback.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ success: true, count: feedbacks.length, feedbacks });
  } catch (error) {
    next(error);
  }
};

// @route  GET /api/feedback (admin)
const getAllFeedback = async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const total = await Feedback.countDocuments(query);
    const feedbacks = await Feedback.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, total, feedbacks });
  } catch (error) {
    next(error);
  }
};

module.exports = { createFeedback, getMyFeedback, getAllFeedback };
