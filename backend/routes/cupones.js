const express = require('express');
const router  = express.Router();
const cuponController = require('../controllers/cuponController');
const verifyToken = require('../middleware/verifyToken');

router.get('/:codigo', verifyToken, cuponController.consultar.bind(cuponController));

module.exports = router;
