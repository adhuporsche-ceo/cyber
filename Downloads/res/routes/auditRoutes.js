const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { protect, canAny } = require('../middleware/authMiddleware');

// Only admin users can view audit logs
router.use(protect);
router.use(canAny('audit.view.all', 'audit.view.own'));

router.get('/', getAuditLogs);

module.exports = router;
