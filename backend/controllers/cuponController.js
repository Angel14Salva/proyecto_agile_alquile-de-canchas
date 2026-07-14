'use strict';

const cuponService = require('../services/cuponService');
const db = require('../db/connection');

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

  async listarMisCupones(req, res) {
    const userId = req.user.userId;
    try {
      const [rows] = await db.query(
        `SELECT c.id, c.codigo, c.valor_inicial, c.saldo, c.estado, c.motivo, c.created_at,
                r.codigo AS reserva_codigo
         FROM cupones c
         JOIN reservas r ON c.reserva_origen_id = r.id
         WHERE r.usuario_id = ?
         ORDER BY c.created_at DESC`,
        [userId]
      );
      res.json(rows);
    } catch (err) {
      console.error('Error al listar cupones del usuario:', err);
      res.status(500).json({ error: 'Error al listar tus cupones' });
    }
  }
}

module.exports = new CuponController();
