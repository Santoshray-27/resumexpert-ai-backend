const express = require('express');
const router = express.Router();
const { getRecommendations, getJobs, getJob, createJob, updateJob, deleteJob, searchJobs } = require('../controllers/job.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/recommendations', protect, getRecommendations);
router.post('/search', protect, searchJobs);
router.get('/', getJobs);
router.get('/:id', getJob);
router.post('/', protect, authorize('recruiter', 'admin'), createJob);
router.put('/:id', protect, authorize('recruiter', 'admin'), updateJob);
router.delete('/:id', protect, authorize('recruiter', 'admin'), deleteJob);

module.exports = router;
