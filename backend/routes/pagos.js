const express = require('express');
const router  = express.Router();
const { registrar, getByReserva } = require('../controllers/pagoController');
const verifyToken = require('../middleware/verifyToken');

router.post('/',                        verifyToken, registrar);
router.get('/reserva/:reserva_id',      verifyToken, getByReserva);

module.exports = router;
