const express = require('express');
const router = express.Router();
const { analyzeResumeController, getAnalysisForResume, getAnalysis, getAllMyAnalyses } = require('../controllers/analysis.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/my/all', protect, getAllMyAnalyses);
router.post('/analyze/:resumeId', protect, analyzeResumeController);
router.get('/resume/:resumeId', protect, getAnalysisForResume);
router.get('/:id', protect, getAnalysis);

module.exports = router;
