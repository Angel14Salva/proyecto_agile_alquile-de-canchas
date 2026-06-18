const express = require('express');
const router  = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');

router.post('/register',        register);
router.post('/login',           login);
router.get('/me',               verifyToken, authController.me.bind(authController));
router.post('/forgot-password', authController.forgotPassword.bind(authController));
router.post('/reset-password',  resetPassword);

module.exports = router;
