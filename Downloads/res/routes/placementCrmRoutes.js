const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  getApplications,
  applyForCompany,
  updateApplicationStatus,
  scheduleInterview,
  releaseOffer,
  mentorReviewResume,
  getStudentPlacementOverview,
  getPlacementStats,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/placementCrmController');

// Companies
router.get('/companies', getCompanies);
router.post('/companies', protect, authorize('SUPER_ADMIN', 'PLACEMENT_COORDINATOR', 'admin'), createCompany);
router.get('/companies/:id', getCompanyById);
router.put('/companies/:id', protect, authorize('SUPER_ADMIN', 'PLACEMENT_COORDINATOR', 'admin'), updateCompany);
router.delete('/companies/:id', protect, authorize('SUPER_ADMIN', 'PLACEMENT_COORDINATOR', 'admin'), deleteCompany);

// Applications
router.get('/applications', protect, getApplications);
router.post('/applications', protect, applyForCompany);
router.put(
  '/applications/:id/status',
  protect,
  authorize('SUPER_ADMIN', 'PLACEMENT_COORDINATOR', 'HOD', 'FACULTY_MENTOR', 'admin', 'faculty'),
  updateApplicationStatus
);
router.put('/applications/:id/interview', protect, authorize('SUPER_ADMIN', 'PLACEMENT_COORDINATOR', 'admin'), scheduleInterview);
router.put('/applications/:id/offer', protect, authorize('SUPER_ADMIN', 'PLACEMENT_COORDINATOR', 'admin'), releaseOffer);
router.put(
  '/applications/:id/mentor-review',
  protect,
  authorize('SUPER_ADMIN', 'FACULTY_MENTOR', 'HOD', 'admin', 'faculty'),
  mentorReviewResume
);

// Student Cockpit & Dashboard Analytics
router.get('/student/overview', protect, getStudentPlacementOverview);
router.get('/stats', protect, getPlacementStats);

// Notifications
router.get('/notifications', protect, getNotifications);
router.put('/notifications/read-all', protect, markAllNotificationsRead);
router.put('/notifications/:id/read', protect, markNotificationRead);

module.exports = router;
