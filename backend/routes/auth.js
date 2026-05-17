const express = require('express');
const router  = express.Router();
const { register, login, me, forgotPassword, resetPassword } = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');

router.post('/register',        register);
router.post('/login',           login);
router.get('/me',               verifyToken, me);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

module.exports = router;
