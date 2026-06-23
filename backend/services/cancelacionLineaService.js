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
    const esPasarela = ['flow', 'tarjeta'].includes(data.pago.metodo);

    if (esPasarela) {
      const resultado = await reembolsoPasarelaAdapter.solicitarReembolso({
        tokenPago: data.pago.referencia,
        monto: info.montoReembolsar,
        reservaId,
        codigo: data.reserva.codigo
      });

      if (!resultado.exito) {
        await db.query('UPDATE reservas SET estado = "pendiente_reembolso" WHERE id = ?', [reservaId]);
        try {
          await enviarCancelacionLinea(data.reserva.cliente_email, {
            nombre: data.reserva.cliente_nombre,
            codigo: data.reserva.codigo,
            monto: info.montoReembolsar.toFixed(2),
            exito: false,
            mensaje: 'Tu solicitud de cancelacion quedo en revision. El reembolso via pasarela no pudo completarse automaticamente.'
          });
        } catch (e) { /* noop */ }
        return {
          ok: true,
          pendiente_reembolso: true,
          message: 'Reserva en pendiente de reembolso para revision de recepcion',
          monto_reembolsar: info.montoReembolsar
        };
      }
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE reservas SET estado = "cancelada", cancelado_at = NOW() WHERE id = ?', [reservaId]);
      await conn.query('UPDATE pagos SET estado = "reembolsado" WHERE id = ?', [data.pago.id]);

      const comprobante = await comprobanteService.obtenerComprobanteOriginal(conn, data.pago.id, reservaId);
      const notaCredito = await comprobanteService.generarNotaCredito(conn, {
        comprobanteId: comprobante.id,
        reservaId,
        monto: info.montoReembolsar,
        canceladoPor: userId
      });

      await conn.commit();

      try {
        await enviarCancelacionLinea(data.reserva.cliente_email, {
          nombre: data.reserva.cliente_nombre,
          codigo: data.reserva.codigo,
          monto: info.montoReembolsar.toFixed(2),
          exito: true,
          mensaje: 'Tu reserva fue cancelada y el reembolso fue procesado.'
        });
      } catch (e) { /* noop */ }

      return {
        ok: true,
        message: 'Reserva cancelada y reembolso procesado',
        monto_reembolsado: info.montoReembolsar,
        nota_credito: { ...notaCredito, comprobante_original: comprobante.numero }
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
