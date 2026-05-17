const express = require('express');
const router  = express.Router();
const { getAll, getById, create, update, buscar } = require('../controllers/usuarioController');
const verifyToken = require('../middleware/verifyToken');
const checkRole   = require('../middleware/checkRole');

router.get('/buscar', verifyToken, checkRole('admin','recepcionista'), buscar);
router.get('/',       verifyToken, checkRole('admin'), getAll);
router.get('/:id',    verifyToken, checkRole('admin'), getById);
router.post('/',      verifyToken, checkRole('admin'), create);
router.put('/:id',    verifyToken, checkRole('admin'), update);

module.exports = router;
