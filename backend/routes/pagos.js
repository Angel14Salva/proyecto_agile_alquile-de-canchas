const express = require('express');
const router  = express.Router();
const pagoController = require('../controllers/pagoController');
const verifyToken = require('../middleware/verifyToken');

router.post('/',                        verifyToken, pagoController.registrar.bind(pagoController));
router.post('/reserva-con-pago',        verifyToken, pagoController.crearConPago.bind(pagoController));
router.get('/reserva/:reserva_id',      verifyToken, pagoController.getByReserva.bind(pagoController));

module.exports = router;
