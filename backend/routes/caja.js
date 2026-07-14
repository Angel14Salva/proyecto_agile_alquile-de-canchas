const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');

router.get('/estado',    verifyToken, checkRole('admin', 'recepcionista'), cajaController.estado.bind(cajaController));
router.post('/abrir',    verifyToken, checkRole('admin', 'recepcionista'), cajaController.abrir.bind(cajaController));
router.post('/cerrar',   verifyToken, checkRole('admin', 'recepcionista'), cajaController.cerrar.bind(cajaController));
router.get('/historial', verifyToken, checkRole('admin', 'recepcionista'), cajaController.historial.bind(cajaController));

module.exports = router;
