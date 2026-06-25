const express    = require('express');
const router     = express.Router();
const flowController = require('../controllers/flowController');
const verifyToken = require('../middleware/verifyToken');

router.post('/crear',      verifyToken, flowController.crear.bind(flowController));
router.post('/confirmar',  flowController.confirmar.bind(flowController));
router.post('/retorno',    verifyToken, flowController.retorno.bind(flowController));
router.post('/retorno-web', flowController.retornoWeb.bind(flowController));
router.get('/retorno-web',  flowController.retornoWeb.bind(flowController));
router.get('/estado',      verifyToken, flowController.estado.bind(flowController));

module.exports = router;
