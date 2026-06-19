const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/reservaGrandeController');
const { verifyToken } = require('../middleware/verifyToken');

router.get('/',    verifyToken, ctrl.getAll);
router.post('/',   verifyToken, ctrl.create);
router.delete('/:id', verifyToken, ctrl.cancel);

module.exports = router;
