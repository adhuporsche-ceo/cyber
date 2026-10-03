const express = require('express');
const router = express.Router();
const { exportReport } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { canAny } = require('../middleware/authMiddleware');

router.use(protect);
router.use(canAny('student.view.all', 'audit.view.own'));

router.get('/export', exportReport);
router.get('/:type', (req, res, next) => {
	req.query.type = req.params.type;
	return exportReport(req, res, next);
});

module.exports = router;
