const express = require('express');
const router = express.Router();
const { createFeedback, getMyFeedback, getAllFeedback } = require('../controllers/feedback.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.post('/', protect, createFeedback);
router.get('/my', protect, getMyFeedback);
router.get('/', protect, authorize('admin'), getAllFeedback);

module.exports = router;
