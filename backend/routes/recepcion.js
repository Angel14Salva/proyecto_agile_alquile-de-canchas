const express = require('express');
const router = express.Router();
const recepcionController = require('../controllers/recepcionController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');

router.get('/check-in', verifyToken, checkRole('admin', 'recepcionista'), recepcionController.buscarCheckIn.bind(recepcionController));
router.post('/check-in/:id/confirmar', verifyToken, checkRole('admin', 'recepcionista'), recepcionController.confirmarIngreso.bind(recepcionController));

module.exports = router;
