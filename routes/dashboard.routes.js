const express = require('express');
const router = express.Router();
const { getDashboardStats, getAdminStats } = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/stats', protect, getDashboardStats);
router.get('/admin', protect, authorize('admin'), getAdminStats);

module.exports = router;
