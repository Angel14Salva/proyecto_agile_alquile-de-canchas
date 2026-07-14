'use strict';

const cuponService = require('../services/cuponService');

class CuponController {
  async consultar(req, res) {
    const { codigo } = req.params;
    if (!codigo) {
      return res.status(400).json({ error: 'Código de cupón requerido' });
    }

    try {
      const cupon = await cuponService.consultarSaldo(codigo);
      if (!cupon) {
        return res.status(404).json({ error: 'El cupón ingresado no existe o no es válido' });
      }
      res.json(cupon);
    } catch (err) {
      console.error('Error al consultar saldo de cupón:', err);
      res.status(500).json({ error: 'Error al consultar saldo del cupón' });
    }
  }
}

module.exports = new CuponController();
