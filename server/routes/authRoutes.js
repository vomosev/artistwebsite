const express = require('express');
const {
  signup,
  login,
  logout,
  me,
} = require('../controllers/authController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.post('/api/auth/signup', signup);
router.post('/api/auth/login', login);
router.post('/api/auth/logout', requireAuth, logout);
router.get('/api/auth/me', requireAuth, me);

module.exports = router;