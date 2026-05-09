const express = require('express');
const router = express.Router();
const { uploadResume, getMyResumes, getResume, updateResume, deleteResume } = require('../controllers/resume.controller');
const { protect } = require('../middleware/auth.middleware');
const { handleResumeUpload } = require('../middleware/upload.middleware');

router.get('/', protect, getMyResumes);
router.post('/upload', protect, handleResumeUpload, uploadResume);
router.get('/:id', protect, getResume);
router.put('/:id', protect, updateResume);
router.delete('/:id', protect, deleteResume);

module.exports = router;
