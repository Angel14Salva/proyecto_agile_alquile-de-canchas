const express = require('express');
const router  = express.Router();
const reservaController = require('../controllers/reservaController');
const verifyToken = require('../middleware/verifyToken');
const checkRole   = require('../middleware/checkRole');

router.get('/', verifyToken, reservaController.getAll.bind(reservaController));
router.get('/buscar-cancelacion', verifyToken, checkRole('admin', 'recepcionista'), reservaController.buscarCancelacion.bind(reservaController));
router.get('/codigo/:codigo', verifyToken, reservaController.getByCode.bind(reservaController));
router.get('/:id/cancelar-linea/preview', verifyToken, checkRole('cliente'), reservaController.cancelarLineaPreview.bind(reservaController));
router.post('/:id/cancelar-linea', verifyToken, checkRole('cliente'), reservaController.cancelarLinea.bind(reservaController));
router.post('/:id/cancelar-recepcion', verifyToken, checkRole('admin', 'recepcionista'), reservaController.cancelarRecepcion.bind(reservaController));
router.get('/:id', verifyToken, reservaController.getById.bind(reservaController));
router.post('/', verifyToken, reservaController.create.bind(reservaController));
router.put('/:id', verifyToken, reservaController.update.bind(reservaController));
router.delete('/:id', verifyToken, reservaController.cancel.bind(reservaController));

module.exports = router;
