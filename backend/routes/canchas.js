const express = require('express');
const router  = express.Router();
const { getAll, getById, getDisponibilidad, create, update } = require('../controllers/canchaController');
const verifyToken = require('../middleware/verifyToken');
const checkRole   = require('../middleware/checkRole');

router.get('/',                    getAll);
router.get('/:id',                 getById);
router.get('/:id/disponibilidad',  getDisponibilidad);
router.post('/',   verifyToken, checkRole('admin'), create);
router.put('/:id', verifyToken, checkRole('admin'), update);

module.exports = router;
