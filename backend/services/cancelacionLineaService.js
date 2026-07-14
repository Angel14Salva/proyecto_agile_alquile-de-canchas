'use strict';

const db = require('../db/connection');
const reembolsoPasarelaAdapter = require('./reembolsoPasarelaAdapter');
const comprobanteService = require('./comprobanteService');
const { clasificarPago, tienePagoRegistrado } = require('./pagoHelper');
const { enviarCancelacionLinea } = require('./emailService');

class CancelacionLineaService {
  puedeCancelar(reserva, pago) {
    if (reserva.estado === 'cancelada') return { valido: false, error: 'La reserva ya esta cancelada' };
    if (reserva.estado === 'completada') return { valido: false, error: 'No se puede cancelar una reserva finalizada' };
    if (reserva.estado === 'pendiente_reembolso') return { valido: false, error: 'La reserva esta pendiente de reembolso' };
    const ahora = new Date();
    const inicio = new Date(String(reserva.fecha).substring(0, 10) + 'T' + String(reserva.hora_inicio).substring(0, 8));
    if (inicio <= ahora) return { valido: false, error: 'No se puede cancelar una reserva ya iniciada' };
    if (!tienePagoRegistrado(pago?.estado, pago?.monto) && reserva.origen === 'linea') {
      return { valido: false, error: 'Solo se pueden cancelar reservas pagadas en linea' };
    }
    return { valido: true };
  }

  async preview(reservaId, userId) {
    const data = await this.#cargarReserva(reservaId, userId);
    if (!data.ok) return data;
    const info = clasificarPago(data.pago?.monto, data.reserva.precio_hora, data.pago?.tipo_pago);
    return {
      ok: true,
      reserva: data.reserva,
      monto_reembolsar: info.montoReembolsar,
      tipo_pago: info.tipo
    };
  }

  async cancelar(reservaId, userId) {
    const data = await this.#cargarReserva(reservaId, userId);
    if (!data.ok) return data;

    const validacion = this.puedeCancelar(data.reserva, data.pago);
    if (!validacion.valido) return { ok: false, error: validacion.error, status: 400 };

    const info = clasificarPago(data.pago.monto, data.reserva.precio_hora, data.pago.tipo_pago);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      
      const ahora = new Date();
      await conn.query('UPDATE reservas SET estado = "cancelada", cancelado_at = NOW(), cancelado_por = ? WHERE id = ?', [userId, reservaId]);

      let cupon = null;
      let notaCredito = null;
      let comprobante = null;

      if (tienePagoRegistrado(data.pago?.estado, data.pago?.monto)) {
        const cuponService = require('./cuponService');
        cupon = await cuponService.generarCupon(conn, {
          monto: info.montoReembolsar,
          motivo: 'Cancelación en línea por el cliente con más de 2 horas de anticipación',
          reservaOrigenId: reservaId,
          generadoPor: userId
        });

        await conn.query(
          `UPDATE pagos
           SET estado = 'reembolsado',
               reembolso_metodo = 'cupon',
               reembolso_confirmado_at = ?
           WHERE id = ?`,
          [ahora, data.pago.id]
        );

        comprobante = await comprobanteService.obtenerComprobanteOriginal(conn, data.pago.id, reservaId);
        notaCredito = await comprobanteService.generarNotaCredito(conn, {
          comprobanteId: comprobante.id,
          reservaId,
          monto: info.montoReembolsar,
          canceladoPor: userId
        });
      }

      await conn.commit();

      try {
        await enviarCancelacionLinea(data.reserva.cliente_email, {
          nombre: data.reserva.cliente_nombre,
          codigo: data.reserva.codigo,
          monto: info.montoReembolsar.toFixed(2),
          exito: true,
          mensaje: 'Tu reserva fue cancelada y se generó tu cupón de reembolso.'
        });
      } catch (e) { /* noop */ }

      return {
        ok: true,
        message: 'Reserva cancelada y reembolso procesado con cupón',
        monto_reembolsado: info.montoReembolsar,
        cupon,
        nota_credito: notaCredito ? { ...notaCredito, comprobante_original: comprobante.numero } : null
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async #cargarReserva(reservaId, userId) {
    const [rows] = await db.query(
      `SELECT r.*, c.precio_hora, c.nombre AS cancha_nombre,
              u.email AS cliente_email,
              p.id AS pago_id, p.estado AS pago_estado, p.monto AS pago_monto,
              p.tipo_pago, p.metodo, p.referencia
       FROM reservas r
       JOIN canchas c ON r.cancha_id = c.id
       JOIN usuarios u ON r.usuario_id = u.id
       LEFT JOIN pagos p ON p.reserva_id = r.id
       WHERE r.id = ? AND r.usuario_id = ?`,
      [reservaId, userId]
    );
    if (rows.length === 0) return { ok: false, error: 'Reserva no encontrada', status: 404 };
    const r = rows[0];
    return {
      ok: true,
      reserva: {
        id: r.id, codigo: r.codigo, estado: r.estado, origen: r.origen,
        fecha: r.fecha, hora_inicio: r.hora_inicio, precio_hora: r.precio_hora,
        cliente_nombre: r.cliente_nombre, cliente_email: r.cliente_email
      },
      pago: r.pago_id ? {
        id: r.pago_id, estado: r.pago_estado, monto: r.pago_monto,
        tipo_pago: r.tipo_pago, metodo: r.metodo, referencia: r.referencia
      } : null
    };
  }
}

module.exports = new CancelacionLineaService();
