'use strict';
const pagoService = require('../services/pagoService');

class PagoController {
  async registrar(req, res) {
    const { reserva_id } = req.body;
    if (!reserva_id) return res.status(400).json({ error: 'reserva_id es requerido' });

    const esStaff = ['recepcionista', 'admin'].includes(req.user.rol);
    if (!esStaff) return res.status(403).json({ error: 'Solo recepcion puede registrar pagos presenciales' });

    try {
      const resultado = await pagoService.registrarPagoRecepcion({
        reservaId: parseInt(reserva_id, 10),
        body: req.body,
        registradoPor: req.user.userId,
        esSaldo: Boolean(req.body.es_saldo)
      });
      if (!resultado.ok) return res.status(resultado.status).json({ error: resultado.error });
      res.status(201).json(resultado);
    } catch (err) {
      console.error('Error en registrar pago:', err);
      res.status(500).json({ error: 'Error al registrar pago' });
    }
  }

  async crearConPago(req, res) {
    const esStaff = ['recepcionista', 'admin'].includes(req.user.rol);
    if (!esStaff) return res.status(403).json({ error: 'Solo recepcion puede registrar reservas con pago' });

    try {
      const resultado = await pagoService.crearReservaConPago({
        ...req.body,
        usuarioId: req.user.userId
      });
      if (!resultado.ok) return res.status(resultado.status).json({ error: resultado.error });
      res.status(201).json(resultado);
    } catch (err) {
      console.error('Error en crearConPago:', err);
      res.status(500).json({ error: 'Error al crear la reserva con pago' });
    }
  }

  async getByReserva(req, res) {
    try {
      const [rows] = await require('../db/connection').query(
        `SELECT p.*, u.nombre AS registrado_por_nombre, c.numero AS comprobante_numero
         FROM pagos p
         LEFT JOIN usuarios u ON p.registrado_por = u.id
         LEFT JOIN comprobantes c ON c.pago_id = p.id
         WHERE p.reserva_id = ?`,
        [req.params.reserva_id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
      const p = rows[0];
      const saldo = pagoService.calcularSaldo(
        (await require('../db/connection').query(
          'SELECT c.precio_hora FROM reservas r JOIN canchas c ON r.cancha_id = c.id WHERE r.id = ?',
          [req.params.reserva_id]
        ))[0][0]?.precio_hora,
        p.monto,
        p.tipo_pago
      );
      res.json({ ...p, ...saldo });
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener pago' });
    }
  }
}

module.exports = new PagoController();
