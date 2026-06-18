const express = require('express');
const router  = express.Router();
const canchaController = require('../controllers/canchaController');
const verifyToken = require('../middleware/verifyToken');
const checkRole   = require('../middleware/checkRole');

router.get('/',                    getAll);
router.get('/:id',                 getById);
router.get('/:id/disponibilidad',  getDisponibilidad);
router.post('/',   verifyToken, checkRole('admin'), canchaController.create.bind(canchaController));
router.put('/:id', verifyToken, checkRole('admin'), canchaController.update.bind(canchaController));

module.exports = router;
