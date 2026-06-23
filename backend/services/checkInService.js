'use strict';

const db = require('../db/connection');
const pagoService = require('./pagoService');

const SELECT_CHECKIN = `
  SELECT r.*, c.nombre AS cancha_nombre, c.precio_hora,
         u.nombre AS usuario_nombre, u.email AS cliente_email, u.telefono AS cliente_telefono,
         p.id AS pago_id, p.estado AS pago_estado, p.metodo AS pago_metodo,
         p.monto AS pago_monto, p.tipo_pago, p.referencia AS pago_referencia
  FROM reservas r
  JOIN canchas c ON r.cancha_id = c.id
  JOIN usuarios u ON r.usuario_id = u.id
  LEFT JOIN pagos p ON p.reserva_id = r.id
`;

class CheckInService {
  enriquecer(row) {
    const saldo = pagoService.calcularSaldo(row.precio_hora, row.pago_monto, row.tipo_pago);
    return {
      id: row.id,
      codigo: row.codigo,
      cancha_nombre: row.cancha_nombre,
      precio_hora: parseFloat(row.precio_hora),
      fecha: row.fecha,
      hora_inicio: row.hora_inicio,
      hora_fin: row.hora_fin,
      estado: row.estado,
      origen: row.origen,
      cliente_nombre: row.cliente_nombre || row.usuario_nombre,
      cliente_dni: row.cliente_dni,
      cliente_email: row.cliente_email,
      cliente_telefono: row.cliente_telefono,
      pago_estado: saldo.estado_pago,
      pago_monto: saldo.monto_pagado,
      saldo_pendiente: saldo.saldo_pendiente,
      tipo_pago: saldo.tipo_pago,
      pago_metodo: row.pago_metodo,
      puede_cobrar: saldo.estado_pago !== 'completo' && row.estado !== 'cancelada',
      puede_confirmar_ingreso: saldo.estado_pago === 'completo' && row.estado === 'confirmada',
      checkin_at: row.checkin_at
    };
  }

  async buscar(q) {
    const termino = q.trim();
    if (/^RES-\d{4}-\d+$/i.test(termino)) {
      const [rows] = await db.query(`${SELECT_CHECKIN} WHERE r.codigo = ?`, [termino.toUpperCase()]);
      return rows.map(r => this.enriquecer(r));
    }
    if (/^\d+$/.test(termino)) {
      const [rows] = await db.query(`${SELECT_CHECKIN} WHERE r.id = ?`, [parseInt(termino, 10)]);
      return rows.map(r => this.enriquecer(r));
    }

    const like = `%${termino}%`;
    const [rows] = await db.query(
      `${SELECT_CHECKIN} WHERE (
        r.cliente_nombre LIKE ? OR r.cliente_dni = ? OR u.nombre LIKE ?
        OR u.dni = ? OR u.email LIKE ?
      ) AND r.estado != 'cancelada'
      ORDER BY r.fecha DESC LIMIT 10`,
      [like, termino, like, termino, like]
    );
    return rows.map(r => this.enriquecer(r));
  }

  async confirmarIngreso(reservaId, recepcionistaId) {
    const [rows] = await db.query(`${SELECT_CHECKIN} WHERE r.id = ?`, [reservaId]);
    if (rows.length === 0) return { ok: false, error: 'Reserva no encontrada', status: 404 };
    const detalle = this.enriquecer(rows[0]);
    if (detalle.pago_estado !== 'completo') {
      return { ok: false, error: 'La reserva no tiene pago completo. Registre el saldo pendiente primero.', status: 400 };
    }
    if (detalle.estado === 'cancelada') {
      return { ok: false, error: 'La reserva esta cancelada', status: 400 };
    }
    await db.query(
      'UPDATE reservas SET checkin_at = NOW(), checkin_por = ? WHERE id = ?',
      [recepcionistaId, reservaId]
    );
    return { ok: true, message: 'Ingreso confirmado', reserva: { ...detalle, checkin_at: new Date() } };
  }
}

module.exports = new CheckInService();
