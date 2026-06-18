const express = require('express');
const router  = express.Router();
const { getAll, getById, getByCode, create, update, cancel } = require('../controllers/reservaController');
const verifyToken = require('../middleware/verifyToken');

router.get('/',       verifyToken, getAll);
router.get('/codigo/:codigo', verifyToken, getByCode);
router.get('/:id',    verifyToken, getById);
router.post('/',      verifyToken, create);
router.put('/:id',    verifyToken, update);
router.delete('/:id', verifyToken, cancel);

module.exports = router;
