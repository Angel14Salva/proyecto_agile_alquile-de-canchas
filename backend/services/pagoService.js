'use strict';

const db = require('../db/connection');
const { validarRegistroPago } = require('../validators/pagoValidator');
const comprobanteService = require('./comprobanteService');
const { enviarConfirmacionPago } = require('./emailService');

class PagoService {
  calcularSaldo(precioTotal, montoPagado, tipoPago) {
    const total = parseFloat(precioTotal) || 0;
    const pagado = parseFloat(montoPagado) || 0;
    if (pagado <= 0) return { estado_pago: 'pendiente', monto_pagado: 0, saldo_pendiente: total, tipo_pago: null };
    if (tipoPago === 'adelanto' || (pagado > 0 && pagado < total - 0.01)) {
      return { estado_pago: 'adelanto', monto_pagado: pagado, saldo_pendiente: Math.round((total - pagado) * 100) / 100, tipo_pago: 'adelanto' };
    }
    return { estado_pago: 'completo', monto_pagado: pagado, saldo_pendiente: 0, tipo_pago: 'completo' };
  }

  async verificarReferenciaDuplicada(referencia, excluirReservaId = null) {
    if (!referencia) return false;
    let sql = 'SELECT id FROM pagos WHERE referencia = ? AND estado = "pagado"';
    const params = [referencia];
    if (excluirReservaId) { sql += ' AND reserva_id != ?'; params.push(excluirReservaId); }
    const [rows] = await db.query(sql, params);
    return rows.length > 0;
  }

  async registrarPagoRecepcion({ reservaId, body, registradoPor, esSaldo = false }) {
    const [reservaRows] = await db.query(
      `SELECT r.*, c.precio_hora, u.email AS cliente_email, u.nombre AS usuario_nombre
       FROM reservas r JOIN canchas c ON r.cancha_id = c.id JOIN usuarios u ON r.usuario_id = u.id
       WHERE r.id = ?`,
      [reservaId]
    );
    if (reservaRows.length === 0) return { ok: false, error: 'Reserva no encontrada', status: 404 };
    const reserva = reservaRows[0];
    if (reserva.estado === 'cancelada') return { ok: false, error: 'No se puede pagar una reserva cancelada', status: 400 };

    const precioTotal = parseFloat(reserva.precio_hora);
    const [pagoExiste] = await db.query('SELECT * FROM pagos WHERE reserva_id = ?', [reservaId]);
    const pagoActual = pagoExiste[0];
    let saldoPendiente = null;

    if (pagoActual && pagoActual.estado === 'pagado') {
      if (pagoActual.tipo_pago === 'completo') {
        return { ok: false, error: 'Esta reserva ya tiene un pago completo registrado', status: 409 };
      }
      saldoPendiente = Math.round((precioTotal - parseFloat(pagoActual.monto)) * 100) / 100;
    }

    const validacion = validarRegistroPago(body, precioTotal, esSaldo || saldoPendiente !== null ? saldoPendiente : null);
    if (!validacion.valido) return { ok: false, error: validacion.error, status: 400 };

    const duplicada = await this.verificarReferenciaDuplicada(validacion.referencia, reservaId);
    if (duplicada) return { ok: false, error: 'El numero de operacion ya fue registrado', status: 409 };

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      let pagoId;
      let montoFinal = validacion.monto;
      let tipoFinal = validacion.tipo_pago;

      if (pagoActual && pagoActual.tipo_pago === 'adelanto') {
        montoFinal = Math.round((parseFloat(pagoActual.monto) + validacion.monto) * 100) / 100;
        tipoFinal = 'completo';
        await conn.query(
          `UPDATE pagos SET monto = ?, metodo = ?, tipo_pago = ?, referencia = ?, notas = COALESCE(?, notas), registrado_por = ? WHERE id = ?`,
          [montoFinal, validacion.metodo, tipoFinal, validacion.referencia, validacion.notas, registradoPor, pagoActual.id]
        );
        pagoId = pagoActual.id;
      } else if (pagoActual) {
        await conn.query(
          `UPDATE pagos SET monto = ?, metodo = ?, estado = 'pagado', tipo_pago = ?, referencia = ?, notas = ?, registrado_por = ? WHERE id = ?`,
          [validacion.monto, validacion.metodo, validacion.tipo_pago, validacion.referencia, validacion.notas, registradoPor, pagoActual.id]
        );
        pagoId = pagoActual.id;
      } else {
        const [ins] = await conn.query(
          `INSERT INTO pagos (reserva_id, monto, metodo, estado, tipo_pago, referencia, notas, registrado_por)
           VALUES (?, ?, ?, 'pagado', ?, ?, ?, ?)`,
          [reservaId, validacion.monto, validacion.metodo, validacion.tipo_pago, validacion.referencia, validacion.notas, registradoPor]
        );
        pagoId = ins.insertId;
      }

      await conn.query('UPDATE reservas SET estado = "confirmada" WHERE id = ?', [reservaId]);

      const comprobante = await comprobanteService.crearComprobante(conn, {
        pagoId,
        reservaId,
        tipo: validacion.tipo_comprobante
      });

      await conn.commit();

      const saldo = this.calcularSaldo(precioTotal, montoFinal, tipoFinal);

      try {
        await enviarConfirmacionPago(reserva.cliente_email, {
          nombre: reserva.cliente_nombre || reserva.usuario_nombre,
          codigo: reserva.codigo,
          monto: montoFinal,
          tipo_pago: tipoFinal,
          comprobante: comprobante.numero
        });
      } catch (e) { console.error('Error correo pago:', e.message); }

      return {
        ok: true,
        message: tipoFinal === 'adelanto' ? 'Adelanto registrado correctamente' : 'Pago registrado y reserva confirmada',
        monto: montoFinal,
        tipo_pago: tipoFinal,
        comprobante: comprobante.numero,
        saldo
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new PagoService();
