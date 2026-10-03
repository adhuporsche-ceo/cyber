const express = require('express');
const { protect, canAny } = require('../middleware/authMiddleware');
const {
  submitApplication,
  listApplications,
  getMyApplication,
  reviewApplication,
} = require('../controllers/studentApplicationController');

const router = express.Router();

router.post('/', protect, canAny('student.create', 'student.mentor-action'), submitApplication);
router.get('/mine', protect, getMyApplication);
router.get('/', protect, canAny('student.view.all', 'student.mentor-action'), listApplications);
router.patch('/:id/status', protect, canAny('student.view.all', 'student.mentor-action'), reviewApplication);

module.exports = router;