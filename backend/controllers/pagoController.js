'use strict';
const db = require('../db/connection');

class PagoController {
  async registrar(req, res) {
    const { reserva_id, metodo, referencia } = req.body;
    if (!reserva_id || !metodo) return res.status(400).json({ error: 'reserva_id y metodo son requeridos' });
    try {
      const [reserva] = await db.query('SELECT id, cancha_id, usuario_id, estado FROM reservas WHERE id = ?', [reserva_id]);
      if (reserva.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });
      if (reserva[0].estado === 'cancelada') return res.status(400).json({ error: 'No se puede pagar una reserva cancelada' });
      const [pagoExiste] = await db.query('SELECT id, estado FROM pagos WHERE reserva_id = ?', [reserva_id]);
      if (pagoExiste.length > 0 && pagoExiste[0].estado === 'pagado') return res.status(409).json({ error: 'Esta reserva ya tiene un pago registrado' });
      const [cancha] = await db.query('SELECT precio_hora FROM canchas WHERE id = ?', [reserva[0].cancha_id]);
      const monto = cancha[0].precio_hora;
      const registrado_por = ['recepcionista', 'admin'].includes(req.user.rol) ? req.user.userId : null;
      if (pagoExiste.length > 0) {
        await db.query('UPDATE pagos SET metodo = ?, estado = "pagado", referencia = ?, registrado_por = ? WHERE reserva_id = ?', [metodo, referencia || null, registrado_por, reserva_id]);
      } else {
        await db.query('INSERT INTO pagos (reserva_id, monto, metodo, estado, referencia, registrado_por) VALUES (?, ?, ?, "pagado", ?, ?)', [reserva_id, monto, metodo, referencia || null, registrado_por]);
      }
      await db.query('UPDATE reservas SET estado = "confirmada" WHERE id = ?', [reserva_id]);
      res.status(201).json({ message: 'Pago registrado y reserva confirmada', monto, estado: 'pagado' });
    } catch (err) {
      console.error('Error en registrar pago:', err);
      res.status(500).json({ error: 'Error al registrar pago' });
    }
  }
  async getByReserva(req, res) {
    try {
      const [rows] = await db.query('SELECT p.*, u.nombre as registrado_por_nombre FROM pagos p LEFT JOIN usuarios u ON p.registrado_por = u.id WHERE p.reserva_id = ?', [req.params.reserva_id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener pago' });
    }
  }
}

module.exports = new PagoController();
