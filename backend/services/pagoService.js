'use strict';

const db = require('../db/connection');
const { validarRegistroPago, validarPagosHibridos } = require('../validators/pagoValidator');
const comprobanteService = require('./comprobanteService');
const { enviarConfirmacionPago, enviarBoletaVenta, enviarConfirmacionReserva } = require('./emailService');
const cuponService = require('./cuponService');

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

  // Recepcion/admin crean la reserva y la cobran en el mismo paso: la reserva
  // nace ya "confirmada" y pagada (posiblemente con mas de un metodo a la
  // vez, ej. efectivo + tarjeta). Ya no existe adelanto/pago parcial aqui.
  async crearReservaConPago({ cancha_id, fecha, hora_inicio, hora_fin, notas, cliente_nombre, cliente_dni, pagos, tipo_comprobante, email_boleta, usuarioId }) {
    if (!cancha_id || !fecha || !hora_inicio || !hora_fin)
      return { ok: false, error: 'Cancha, fecha, hora inicio y hora fin son requeridos', status: 400 };

    const ahora       = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const fechaReserva = new Date(fecha + 'T' + hora_inicio);
    const diffMin     = (fechaReserva - ahora) / 1000 / 60;
    if (diffMin <= 0) {
      return { ok: false, error: 'No se puede realizar una reserva en una fecha u hora pasada', status: 400 };
    }
    if (!cliente_nombre || !cliente_nombre.trim())
      return { ok: false, error: 'El nombre del cliente es requerido', status: 400 };
    if (!cliente_dni || !/^\d{8}$/.test(cliente_dni))
      return { ok: false, error: 'El DNI debe tener exactamente 8 digitos numericos', status: 400 };

    const [cajaAbierta] = await db.query("SELECT id FROM caja_turnos WHERE estado = 'abierta' LIMIT 1");
    if (cajaAbierta.length === 0) {
      return { ok: false, error: 'No hay una caja abierta. Abre caja antes de registrar reservas con pago.', status: 400 };
    }
    const cajaTurnoId = cajaAbierta[0].id;

    const [ocupadoReserva] = await db.query(
      'SELECT id FROM reservas WHERE cancha_id = ? AND fecha = ? AND estado != "cancelada" AND hora_inicio < ? AND hora_fin > ?',
      [cancha_id, fecha, hora_fin, hora_inicio]
    );
    if (ocupadoReserva.length > 0) return { ok: false, error: 'Ese horario ya esta reservado o se superpone con otra reserva', status: 409 };

    const [ocupadoPendiente] = await db.query(
      `SELECT id FROM reservas_pendientes_pago 
       WHERE cancha_id = ? AND fecha = ? AND estado = 'pendiente' 
         AND created_at >= UTC_TIMESTAMP() - INTERVAL 10 MINUTE
         AND hora_inicio < ? AND hora_fin > ?`,
      [cancha_id, fecha, hora_fin, hora_inicio]
    );
    if (ocupadoPendiente.length > 0) return { ok: false, error: 'Ese horario está bloqueado temporalmente por un intento de pago en línea (expira en 10 minutos)', status: 409 };

    const [canchaRows] = await db.query('SELECT id, nombre, precio_hora FROM canchas WHERE id = ? AND activo = TRUE', [cancha_id]);
    if (canchaRows.length === 0) return { ok: false, error: 'Cancha no encontrada', status: 404 };
    const cancha = canchaRows[0];

    const horas = Math.max(1, (parseInt(hora_fin.split(':')[0]) - parseInt(hora_inicio.split(':')[0])));
    const precioTotal = parseFloat(cancha.precio_hora) * horas;

    const validacion = validarPagosHibridos(pagos, precioTotal);
    if (!validacion.valido) return { ok: false, error: validacion.error, status: 400 };

    for (const linea of validacion.lineas) {
      const duplicada = await this.verificarReferenciaDuplicada(linea.referencia, null);
      if (duplicada) return { ok: false, error: `El numero de operacion ${linea.referencia} ya fue registrado`, status: 409 };
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const anio = new Date().getFullYear();
      const [crows] = await conn.query('SELECT COUNT(*) as total FROM reservas WHERE YEAR(created_at) = ?', [anio]);
      const codigo = `RES-${anio}-${String(crows[0].total + 1).padStart(3, '0')}`;

      const [result] = await conn.query(
        `INSERT INTO reservas (codigo, cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estado, origen, notas, cliente_nombre, cliente_dni)
         VALUES (?, ?, ?, ?, ?, ?, "confirmada", "recepcion", ?, ?, ?)`,
        [codigo, cancha_id, usuarioId, fecha, hora_inicio, hora_fin, notas || null, cliente_nombre.trim(), cliente_dni]
      );
      const reservaId = result.insertId;

      const referenciaConsolidada = validacion.lineas.length === 1 ? validacion.lineas[0].referencia : null;
      const [pagoResult] = await conn.query(
        `INSERT INTO pagos (reserva_id, monto, metodo, estado, tipo_pago, referencia, registrado_por)
         VALUES (?, ?, ?, 'pagado', 'completo', ?, ?)`,
        [reservaId, validacion.monto, validacion.metodoConsolidado, referenciaConsolidada, usuarioId]
      );
      const pagoId = pagoResult.insertId;

      for (const linea of validacion.lineas) {
        if (linea.metodo === 'cupon') {
          await cuponService.aplicarCupon(conn, {
            codigo: linea.referencia,
            montoSolicitado: linea.monto,
            reservaId,
            registradoPor: usuarioId
          });
        }
        await conn.query(
          `INSERT INTO pagos_movimientos (pago_id, caja_turno_id, metodo, monto, referencia, registrado_por)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pagoId, cajaTurnoId, linea.metodo, linea.monto, linea.referencia, usuarioId]
        );
      }

      const comprobante = await comprobanteService.crearComprobante(conn, {
        pagoId, reservaId, tipo: tipo_comprobante || 'boleta'
      });

      await conn.commit();

      try {
        const [urows] = await db.query('SELECT email FROM usuarios WHERE id = ?', [usuarioId]);
        if (urows.length > 0) {
          await enviarConfirmacionReserva(urows[0].email, {
            nombre: cliente_nombre.trim(), codigo, cancha: cancha.nombre, fecha,
            horaInicio: hora_inicio.substring(0, 5), horaFin: hora_fin.substring(0, 5), monto: precioTotal
          });
          await enviarConfirmacionPago(urows[0].email, {
            nombre: cliente_nombre.trim(), codigo, monto: precioTotal,
            tipo_pago: 'completo', comprobante: comprobante.numero
          });
        }
        if (email_boleta) {
          await enviarBoletaVenta(email_boleta, {
            nombre: cliente_nombre.trim(), codigo, cancha: cancha.nombre, fecha,
            horaInicio: hora_inicio.substring(0, 5), horaFin: hora_fin.substring(0, 5),
            monto: precioTotal, metodo: validacion.metodoConsolidado, referencia: referenciaConsolidada,
            comprobante: tipo_comprobante || 'boleta', numeroComprobante: comprobante.numero
          });
        }
      } catch (mailErr) { console.error('Error enviando correo (reserva con pago):', mailErr.message); }

      return { ok: true, reserva_id: reservaId, codigo, comprobante };
    } catch (err) {
      await conn.rollback();
      console.error('Error en crearReservaConPago:', err);
      return { ok: false, error: 'Error al crear la reserva con pago', status: 500 };
    } finally {
      conn.release();
    }
  }

  async registrarPagoRecepcion({ reservaId, body, registradoPor, esSaldo = false }) {
    const [cajaAbierta] = await db.query("SELECT id FROM caja_turnos WHERE estado = 'abierta' LIMIT 1");
    if (cajaAbierta.length === 0) {
      return { ok: false, error: 'No hay una caja abierta. Abre caja antes de registrar pagos.', status: 400 };
    }
    const cajaTurnoId = cajaAbierta[0].id;

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
      let metodoFinal = validacion.metodo;

      if (pagoActual && pagoActual.tipo_pago === 'adelanto') {
        montoFinal = Math.round((parseFloat(pagoActual.monto) + validacion.monto) * 100) / 100;
        tipoFinal = 'completo';
        // Si el segundo tramo usa un método distinto al primero, la reserva
        // quedó pagada con más de un método (pago mixto/híbrido).
        metodoFinal = (pagoActual.metodo && pagoActual.metodo !== validacion.metodo) ? 'mixto' : validacion.metodo;
        await conn.query(
          `UPDATE pagos SET monto = ?, metodo = ?, tipo_pago = ?, referencia = ?, notas = COALESCE(?, notas), registrado_por = ? WHERE id = ?`,
          [montoFinal, metodoFinal, tipoFinal, validacion.referencia, validacion.notas, registradoPor, pagoActual.id]
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

      if (validacion.metodo === 'cupon') {
        await cuponService.aplicarCupon(conn, {
          codigo: validacion.referencia,
          montoSolicitado: validacion.monto,
          reservaId,
          registradoPor
        });
      }

      // Movimiento real de este cobro (el tramo que se acaba de cobrar, con
      // su método exacto) — es lo que alimenta el cuadre de caja.
      await conn.query(
        `INSERT INTO pagos_movimientos (pago_id, caja_turno_id, metodo, monto, referencia, registrado_por)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pagoId, cajaTurnoId, validacion.metodo, validacion.monto, validacion.referencia, registradoPor]
      );

      await conn.query('UPDATE reservas SET estado = "confirmada" WHERE id = ?', [reservaId]);

      // Un comprobante por reserva: si ya existe (p.ej. se generó con el
      // adelanto), se reutiliza al completar el saldo en vez de duplicarlo.
      const comprobante = pagoActual
        ? await comprobanteService.obtenerComprobanteOriginal(conn, pagoId, reservaId)
        : await comprobanteService.crearComprobante(conn, { pagoId, reservaId, tipo: validacion.tipo_comprobante });

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
      // Enviar boleta si se proporcionó email opcional
      const emailBoleta = body.email_boleta;
      if (emailBoleta) {
        try {
          await enviarBoletaVenta(emailBoleta, {
            nombre: reserva.cliente_nombre || reserva.usuario_nombre,
            codigo: reserva.codigo,
            cancha: reserva.cancha_nombre || 'Cancha',
            fecha: reserva.fecha ? (typeof reserva.fecha === 'string' ? reserva.fecha.substring(0,10) : reserva.fecha.toISOString().substring(0,10)) : '',
            horaInicio: reserva.hora_inicio ? String(reserva.hora_inicio).substring(0,5) : '',
            horaFin: reserva.hora_fin ? String(reserva.hora_fin).substring(0,5) : '',
            monto: montoFinal,
            metodo: body.metodo,
            referencia: body.referencia || null,
            comprobante: body.comprobante || 'boleta',
            numeroComprobante: comprobante.numero
          });
        } catch (e) { console.error('Error boleta venta:', e.message); }
      }

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
