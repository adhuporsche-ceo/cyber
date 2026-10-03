const express = require('express');
const router = express.Router();
const { protect, canAny } = require('../middleware/authMiddleware');
const { getSettings, updateSettings, changePassword } = require('../controllers/settingsController');

router.use(protect);
router.get('/', getSettings);
router.put('/', canAny('settings.manage', 'settings.placement'), updateSettings);
router.put('/password', changePassword);

module.exports = router;
