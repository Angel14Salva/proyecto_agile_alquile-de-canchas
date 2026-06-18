const express = require('express');
const router  = express.Router();
const reservaController = require('../controllers/reservaController');
const verifyToken = require('../middleware/verifyToken');

router.get('/',       verifyToken, reservaController.getAll.bind(reservaController));
router.get('/codigo/:codigo', verifyToken, reservaController.getByCode.bind(reservaController));
router.get('/:id',    verifyToken, reservaController.getById.bind(reservaController));
router.post('/',      verifyToken, reservaController.create.bind(reservaController));
router.put('/:id',    verifyToken, reservaController.update.bind(reservaController));
router.delete('/:id', verifyToken, reservaController.cancel.bind(reservaController));

module.exports = router;
