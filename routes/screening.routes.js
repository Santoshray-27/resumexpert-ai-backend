const express = require('express');
const router = express.Router();
const { screenResumeController, skillGapController, getUserResumes } = require('../controllers/screening.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

router.post('/screen', screenResumeController);
router.post('/skill-gap', skillGapController);
router.get('/resumes', getUserResumes);

module.exports = router;
