const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getDashboard, getMentorAttention, getAnalytics } = require('../controllers/insightController');

router.get('/dashboard/stats', protect, getDashboard);
router.get('/analytics/overview', protect, getAnalytics);
router.get('/mentor/attention', protect, getMentorAttention);

module.exports = router;
