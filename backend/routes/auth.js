const express        = require('express');
const router         = express.Router();
const authController = require('../controllers/authController');
const verifyToken    = require('../middleware/verifyToken');
const { passwordResetLimiter } = require('../middleware/rateLimiter');

router.post('/register',        authController.register.bind(authController));
router.post('/login',           authController.login.bind(authController));
router.post('/logout',          verifyToken, authController.logout.bind(authController));
router.get ('/me',              verifyToken, authController.me.bind(authController));
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword.bind(authController));
router.post('/reset-password',  passwordResetLimiter, authController.resetPassword.bind(authController));
router.post('/verificar-password', verifyToken, authController.verificarPassword.bind(authController));

module.exports = router;
