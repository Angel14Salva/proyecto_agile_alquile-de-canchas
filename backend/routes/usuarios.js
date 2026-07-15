const express = require('express');
const router  = express.Router();
const usuarioController = require('../controllers/usuarioController');
const verifyToken = require('../middleware/verifyToken');
const checkRole   = require('../middleware/checkRole');

router.get('/buscar', verifyToken, checkRole('admin','recepcionista'), usuarioController.buscar.bind(usuarioController));
router.get('/',       verifyToken, checkRole('admin'), usuarioController.getAll.bind(usuarioController));
router.get('/:id',    verifyToken, checkRole('admin'), usuarioController.getById.bind(usuarioController));
router.post('/',      verifyToken, checkRole('admin'), usuarioController.create.bind(usuarioController));
router.put('/:id',    verifyToken, checkRole('admin'), usuarioController.update.bind(usuarioController));
router.delete('/:id', verifyToken, checkRole('admin'), usuarioController.delete.bind(usuarioController));

module.exports = router;
