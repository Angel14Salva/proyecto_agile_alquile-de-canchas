const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/reservaGrandeController');
const verifyToken = require('../middleware/verifyToken');

router.get('/disponibilidad', verifyToken, ctrl.disponibilidad);
router.get('/codigo/:codigo', verifyToken, ctrl.getByCodigo);
router.post('/:id/pago', verifyToken, ctrl.registrarPago);
router.put('/:id', verifyToken, ctrl.update);
router.get('/',    verifyToken, ctrl.getAll);
router.post('/',   verifyToken, ctrl.create);
router.delete('/:id', verifyToken, ctrl.cancel);

module.exports = router;
