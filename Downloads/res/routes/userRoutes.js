const express = require('express');
const router = express.Router();
const { protect, can } = require('../middleware/authMiddleware');
const { listUsers, createUser, updateUser } = require('../controllers/userController');

router.use(protect, can('user.manage'));
router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);

module.exports = router;
