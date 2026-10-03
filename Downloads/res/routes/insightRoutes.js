const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getMentorAttention,
  compareStudents,
  getAnalytics,
} = require('../controllers/insightController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/dashboard', getDashboard);
router.get('/dashboard/stats', getDashboard);
router.get('/mentor-attention', getMentorAttention);
router.get('/mentor/attention', getMentorAttention);
router.get('/compare', compareStudents);
router.get('/analytics', getAnalytics);
router.get('/analytics/overview', getAnalytics);

module.exports = router;
