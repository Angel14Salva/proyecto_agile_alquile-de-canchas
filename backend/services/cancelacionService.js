'use strict';

const db = require('../db/connection');
const { clasificarPago, tienePagoRegistrado } = require('./pagoHelper');
const comprobanteService = require('./comprobanteService');
const { validarCancelacionRecepcion } = require('../validators/cancelacionValidator');
const { enviarCancelacionReserva, enviarCuponReembolso } = require('./emailService');
const cuponService = require('./cuponService');

const SELECT_RESERVA_BASE = `
  SELECT r.*,
         c.nombre AS cancha_nombre,
         c.precio_hora,
         u.nombre AS usuario_nombre,
         u.email AS cliente_email,
         u.telefono AS cliente_telefono,
         u.dni AS usuario_dni,
         p.id AS pago_id,
         p.estado AS pago_estado,
         p.metodo AS pago_metodo,
         p.monto AS pago_monto,
         p.tipo_pago,
         p.referencia AS pago_referencia,
         uc.nombre AS cancelado_por_nombre
  FROM reservas r
  JOIN canchas c ON r.cancha_id = c.id
  JOIN usuarios u ON r.usuario_id = u.id
  LEFT JOIN pagos p ON p.reserva_id = r.id
  LEFT JOIN usuarios uc ON r.cancelado_por = uc.id
`;

class CancelacionService {
  enriquecerReserva(row) {
    const clienteNombre = row.cliente_nombre || row.usuario_nombre;
    const infoPago = clasificarPago(row.pago_monto, row.precio_hora, row.tipo_pago);

    return {
      id: row.id,
      codigo: row.codigo,
      cancha_id: row.cancha_id,
      cancha_nombre: row.cancha_nombre,
      precio_hora: parseFloat(row.precio_hora),
      fecha: row.fecha,
      hora_inicio: row.hora_inicio,
      hora_fin: row.hora_fin,
      estado: row.estado,
      origen: row.origen,
      cliente_nombre: clienteNombre,
      cliente_dni: row.cliente_dni || row.usuario_dni,
      cliente_email: row.cliente_email,
      cliente_telefono: row.cliente_telefono,
      pago_id: row.pago_id,
      pago_estado: row.pago_estado,
      pago_metodo: row.pago_metodo,
      pago_monto: row.pago_monto ? parseFloat(row.pago_monto) : null,
      pago_tipo: infoPago.tipo,
      monto_reembolsar: infoPago.montoReembolsar,
      requiere_reembolso: infoPago.requiereReembolso,
      cancelado_por: row.cancelado_por,
      cancelado_por_nombre: row.cancelado_por_nombre,
      cancelado_at: row.cancelado_at
    };
  }

  async buscarReservas(termino) {
    const q = termino.trim();
    const params = [];
    let filtro = '';

    if (/^RES-\d{4}-\d+$/i.test(q)) {
      filtro = ' AND r.codigo = ?';
      params.push(q.toUpperCase());
    } else if (/^\d+$/.test(q)) {
      filtro = ' AND r.id = ?';
      params.push(parseInt(q, 10));
    } else {
      filtro = ` AND (
        r.codigo LIKE ?
        OR r.cliente_nombre LIKE ?
        OR r.cliente_dni = ?
        OR u.nombre LIKE ?
        OR u.dni = ?
        OR u.email LIKE ?
      )`;
      const like = `%${q}%`;
      params.push(like, like, q, like, q, like);
    }

    const [rows] = await db.query(
      `${SELECT_RESERVA_BASE} WHERE 1=1 ${filtro} ORDER BY r.fecha DESC, r.hora_inicio DESC LIMIT 20`,
      params
    );

    return rows.map((row) => this.enriquecerReserva(row));
  }

  async obtenerReservaDetalle(reservaId) {
    const [rows] = await db.query(`${SELECT_RESERVA_BASE} WHERE r.id = ?`, [reservaId]);
    if (rows.length === 0) return null;
    return this.enriquecerReserva(rows[0]);
  }

  calcularInfoPago(reservaRow) {
    return clasificarPago(reservaRow.pago_monto, reservaRow.precio_hora, reservaRow.tipo_pago);
  }

  validarCancelacionRecepcion(reserva, infoPago, opciones) {
    return validarCancelacionRecepcion({
      reserva,
      infoPago,
      reembolsoConfirmado: opciones.reembolsoConfirmado,
      reembolsoMetodo: opciones.reembolsoMetodo,
      reembolsoExcepcional: opciones.reembolsoExcepcional,
      motivoExcepcional: opciones.motivoExcepcional
    });
  }

  async cancelarRecepcion(reservaId, opciones) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(`${SELECT_RESERVA_BASE} WHERE r.id = ? FOR UPDATE`, [reservaId]);
      if (rows.length === 0) {
        await conn.rollback();
        return { ok: false, error: 'Reserva no encontrada', status: 404 };
      }

      const reserva = rows[0];
      const infoPago = this.calcularInfoPago(reserva);
      const validacion = this.validarCancelacionRecepcion(reserva, infoPago, opciones);

      if (!validacion.valido) {
        await conn.rollback();
        return { ok: false, error: validacion.error, status: validacion.status };
      }

      const ahora = new Date();
      await conn.query(
        `UPDATE reservas
         SET estado = 'cancelada',
             cancelado_por = ?,
             cancelado_at = ?
         WHERE id = ?`,
        [opciones.canceladoPorUserId, ahora, reservaId]
      );

      let notaCredito = null;
      let cupon = null;

      if (tienePagoRegistrado(reserva.pago_estado, reserva.pago_monto)) {
        let reembolsoMetodo = opciones.reembolsoMetodo || null;
        if (opciones.reembolsoExcepcional) {
          reembolsoMetodo = 'cupon';
          cupon = await cuponService.generarCupon(conn, {
            monto: infoPago.montoReembolsar,
            motivo: opciones.motivoExcepcional,
            reservaOrigenId: reservaId,
            generadoPor: opciones.canceladoPorUserId
          });
        }

        await conn.query(
          `UPDATE pagos
           SET estado = 'reembolsado',
               reembolso_metodo = ?,
               reembolso_confirmado_at = ?
           WHERE id = ?`,
          [reembolsoMetodo, ahora, reserva.pago_id]
        );

        const comprobante = await comprobanteService.obtenerComprobanteOriginal(
          conn,
          reserva.pago_id,
          reservaId
        );

        notaCredito = await comprobanteService.generarNotaCredito(conn, {
          comprobanteId: comprobante.id,
          reservaId,
          monto: infoPago.montoReembolsar,
          canceladoPor: opciones.canceladoPorUserId
        });

        notaCredito.comprobante_original = comprobante.numero;
      }

      await conn.commit();

      const detalle = await this.obtenerReservaDetalle(reservaId);

      try {
        await enviarCancelacionReserva(reserva.cliente_email || rows[0].cliente_email, {
          nombre: reserva.cliente_nombre || reserva.usuario_nombre,
          codigo: reserva.codigo,
          cancha: reserva.cancha_nombre,
          fecha: reserva.fecha?.toISOString?.().substring(0, 10) || String(reserva.fecha).substring(0, 10),
          horaInicio: String(reserva.hora_inicio).substring(0, 5),
          horaFin: String(reserva.hora_fin).substring(0, 5)
        });
      } catch (mailErr) {
        console.error('Error enviando correo cancelacion:', mailErr.message);
      }

      if (cupon) {
        try {
          await enviarCuponReembolso(reserva.cliente_email || rows[0].cliente_email, {
            nombre: reserva.cliente_nombre || reserva.usuario_nombre,
            reservaCodigo: reserva.codigo,
            codigo: cupon.codigo,
            monto: cupon.valor_inicial
          });
        } catch (mailErr) {
          console.error('Error enviando correo de cupon:', mailErr.message);
        }
      }

      return {
        ok: true,
        message: 'Reserva cancelada correctamente',
        reserva: detalle,
        nota_credito: notaCredito,
        monto_reembolsado: infoPago.requiereReembolso ? infoPago.montoReembolsar : 0,
        cupon: cupon
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new CancelacionService();
