const express        = require('express');
const router         = express.Router();
const authController = require('../controllers/authController');
const verifyToken    = require('../middleware/verifyToken');

router.post('/register',        authController.register.bind(authController));
router.post('/login',           authController.login.bind(authController));
router.post('/logout',          verifyToken, authController.logout.bind(authController));
router.get ('/me',              verifyToken, authController.me.bind(authController));
router.post('/forgot-password', authController.forgotPassword.bind(authController));
router.post('/reset-password',  authController.resetPassword.bind(authController));

module.exports = router;
