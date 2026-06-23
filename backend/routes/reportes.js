const express = require('express');
const router = express.Router();
const reporteController = require('../controllers/reporteController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');

router.get('/dashboard', verifyToken, checkRole('admin'), reporteController.dashboard.bind(reporteController));
router.get('/caja', verifyToken, checkRole('admin'), reporteController.controlCaja.bind(reporteController));
router.post('/caja-inicial', verifyToken, checkRole('admin'), reporteController.cajaInicial.bind(reporteController));
router.get('/historial', verifyToken, checkRole('admin'), reporteController.historial.bind(reporteController));
router.get('/export/excel', verifyToken, checkRole('admin'), reporteController.exportExcel.bind(reporteController));
router.get('/export/pdf', verifyToken, checkRole('admin'), reporteController.exportPdf.bind(reporteController));

module.exports = router;
