const express = require('express');
const router = express.Router();
const { createSession, submitAnswer, completeSession, getMyInterviews, getInterview } = require('../controllers/interview.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, getMyInterviews);
router.post('/create', protect, createSession);
router.get('/:id', protect, getInterview);
router.post('/:id/answer', protect, submitAnswer);
router.post('/:id/complete', protect, completeSession);

module.exports = router;
