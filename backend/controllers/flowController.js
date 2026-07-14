'use strict';
const crypto = require('crypto');
const axios  = require('axios');
const db     = require('../db/connection');
const { enviarConfirmacionReserva } = require('../services/emailService');
const cuponService = require('../services/cuponService');

console.log("FLOW ENV:", process.env.FLOW_API_KEY?.substring(0,8), process.env.FLOW_SECRET_KEY?.substring(0,8));

function flowSign(params, secretKey) {
  const keys = Object.keys(params).sort();
  const toSign = keys.map(k => k + '=' + params[k]).join('&');
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}

async function flowPost(endpoint, params) {
  const apiKey    = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;
  const apiURL    = process.env.FLOW_API_URL || 'https://www.flow.cl/api';
  params = { ...params, apiKey };
  const sign = flowSign(params, secretKey);
  const body = Object.keys(params).sort().map(k => k + '=' + encodeURIComponent(params[k])).join('&') + '&s=' + sign;
  const response = await axios.post(apiURL + '/' + endpoint, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return response.data;
}

async function flowGet(endpoint, params) {
  const apiKey    = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;
  const apiURL    = process.env.FLOW_API_URL || 'https://www.flow.cl/api';
  params = { ...params, apiKey };
  const sign = flowSign(params, secretKey);
  const query = Object.keys(params).sort().map(k => k + '=' + encodeURIComponent(params[k])).join('&') + '&s=' + sign;
  const response = await axios.get(apiURL + '/' + endpoint + '?' + query);
  return response.data;
}

// Misma validacion de solapamiento que usa reservaController.create
async function horarioDisponible(cancha_id, fecha, hora_inicio, hora_fin) {
  const [ocupado] = await db.query(
    'SELECT id FROM reservas WHERE cancha_id = ? AND fecha = ? AND estado != "cancelada" AND hora_inicio < ? AND hora_fin > ?',
    [cancha_id, fecha, hora_fin, hora_inicio]
  );
  return ocupado.length === 0;
}

async function generarCodigoReserva() {
  const anio = new Date().getFullYear();
  const [rows] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE YEAR(created_at) = ?', [anio]);
  const num = String(rows[0].total + 1).padStart(3, '0');
  return 'RES-' + anio + '-' + num;
}

// Punto único donde, una vez verificado con Flow que el pago fue exitoso,
// se crea recién la reserva real (y se bloquea el horario).
// Idempotente: si ya se proceso este pendiente, no lo vuelve a crear.
async function confirmarPendientePorToken(token) {
  const response = await flowGet('payment/getStatus', { token });
  const commerceOrder = response.commerceOrder || '';
  const match = commerceOrder.match(/^PSC-P(\d+)-/);
  if (!match) return { ok: false, motivo: 'orden_no_reconocida' };
  const pendienteId = parseInt(match[1], 10);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM reservas_pendientes_pago WHERE id = ? FOR UPDATE', [pendienteId]);
    if (rows.length === 0) {
      await conn.rollback();
      return { ok: false, motivo: 'pendiente_no_encontrado' };
    }
    const pendiente = rows[0];

    // Idempotencia
    if (pendiente.estado === 'confirmado' && pendiente.reserva_id) {
      await conn.rollback();
      const [r] = await db.query('SELECT id, codigo FROM reservas WHERE id = ?', [pendiente.reserva_id]);
      return { ok: true, yaConfirmado: true, reserva_id: pendiente.reserva_id, codigo: r[0]?.codigo };
    }

    if (response.status !== 2) {
      // 1=pendiente, 3=rechazado, 4=anulado
      if (pendiente.estado === 'pendiente') {
        await conn.query('UPDATE reservas_pendientes_pago SET estado = "fallido", token = ? WHERE id = ?', [token, pendienteId]);
      }
      await conn.commit();
      return { ok: false, motivo: 'pago_no_completado' };
    }

    // Check availability inside transaction using FOR UPDATE
    const [ocupado] = await conn.query(
      'SELECT id FROM reservas WHERE cancha_id = ? AND fecha = ? AND estado != "cancelada" AND hora_inicio < ? AND hora_fin > ? FOR UPDATE',
      [pendiente.cancha_id, pendiente.fecha, pendiente.hora_fin, pendiente.hora_inicio]
    );

    if (ocupado.length > 0) {
      await conn.query('UPDATE reservas_pendientes_pago SET estado = "conflicto", token = ? WHERE id = ?', [token, pendienteId]);
      await conn.commit();
      return { ok: false, motivo: 'horario_ya_no_disponible', requiereRevision: true };
    }

    // Generate code
    const anio = new Date(pendiente.fecha).getFullYear();
    const [crows] = await conn.query('SELECT COUNT(*) as total FROM reservas WHERE YEAR(created_at) = ?', [anio]);
    const num = String(crows[0].total + 1).padStart(3, '0');
    const codigo = 'RES-' + anio + '-' + num;

    const [result] = await conn.query(
      `INSERT INTO reservas (codigo, cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estado, origen, notas, cliente_nombre, cliente_dni)
       VALUES (?, ?, ?, ?, ?, ?, "confirmada", "linea", ?, ?, ?)`,
      [codigo, pendiente.cancha_id, pendiente.usuario_id, pendiente.fecha, pendiente.hora_inicio, pendiente.hora_fin,
       pendiente.notas, pendiente.cliente_nombre, pendiente.cliente_dni]
    );
    const reserva_id = result.insertId;

    let metodoPago = 'flow';
    if (pendiente.cupon_codigo && parseFloat(pendiente.cupon_monto) > 0) {
      metodoPago = 'mixto';
      try {
        await cuponService.aplicarCupon(conn, {
          codigo: pendiente.cupon_codigo,
          montoSolicitado: parseFloat(pendiente.cupon_monto),
          reservaId: reserva_id,
          registradoPor: pendiente.usuario_id
        });
      } catch (cuponErr) {
        console.error('Error aplicando cupón en webhook:', cuponErr.message);
        // Si el cupón falla por saldo, aún creamos la reserva porque el dinero Flow ya se cobró,
        // pero registramos el pago con el método 'flow' por la diferencia cobrada.
        metodoPago = 'flow';
      }
    }

    const [pagoResult] = await conn.query(
      'INSERT INTO pagos (reserva_id, monto, metodo, estado, tipo_pago, referencia) VALUES (?, ?, ?, "pagado", "completo", ?)',
      [reserva_id, pendiente.monto, metodoPago, token]
    );
    const pagoId = pagoResult.insertId;

    const montoFlow = parseFloat(pendiente.monto) - (metodoPago === 'mixto' ? parseFloat(pendiente.cupon_monto) : 0);
    await conn.query(
      'INSERT INTO pagos_movimientos (pago_id, caja_turno_id, metodo, monto, referencia, registrado_por) VALUES (?, NULL, "flow", ?, ?, NULL)',
      [pagoId, montoFlow, token]
    );

    if (metodoPago === 'mixto') {
      await conn.query(
        'INSERT INTO pagos_movimientos (pago_id, caja_turno_id, metodo, monto, referencia, registrado_por) VALUES (?, NULL, "cupon", ?, ?, NULL)',
        [pagoId, parseFloat(pendiente.cupon_monto), pendiente.cupon_codigo]
      );
    }

    await conn.query('UPDATE reservas_pendientes_pago SET estado = "confirmado", token = ?, reserva_id = ? WHERE id = ?', [token, reserva_id, pendienteId]);

    await conn.commit();

    try {
      const [urows] = await db.query('SELECT nombre, email FROM usuarios WHERE id = ?', [pendiente.usuario_id]);
      const [crow]  = await db.query('SELECT nombre FROM canchas WHERE id = ?', [pendiente.cancha_id]);
      if (urows.length > 0) {
        await enviarConfirmacionReserva(urows[0].email, {
          nombre: pendiente.cliente_nombre,
          codigo,
          cancha: crow[0]?.nombre || '',
          fecha: pendiente.fecha,
          horaInicio: String(pendiente.hora_inicio).substring(0, 5),
          horaFin: String(pendiente.hora_fin).substring(0, 5),
          monto: pendiente.monto
        });
      }
    } catch (mailErr) { console.error('Error enviando correo (flow):', mailErr.message); }

    return { ok: true, reserva_id, codigo };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

class FlowController {
  // Ya NO crea la reserva. Solo valida disponibilidad + guarda los datos como
  // "pendiente de pago" y abre la orden en Flow. La reserva se crea recien
  // cuando el pago se confirma (ver confirmarPendientePorToken).
  async crear(req, res) {
    const { cancha_id, fecha, hora_inicio, hora_fin, notas, cliente_nombre, cliente_dni, cupon_codigo, cupon_monto_aplicar } = req.body;
    const usuario_id = req.user.userId;

    if (!cancha_id || !fecha || !hora_inicio || !hora_fin)
      return res.status(400).json({ error: 'Cancha, fecha, hora inicio y hora fin son requeridos' });
    if (!cliente_nombre || !cliente_nombre.trim())
      return res.status(400).json({ error: 'El nombre del cliente es requerido' });
    if (!cliente_dni || !/^\d{8}$/.test(cliente_dni))
      return res.status(400).json({ error: 'El DNI debe tener exactamente 8 dígitos numéricos' });

    try {
      const disponible = await horarioDisponible(cancha_id, fecha, hora_inicio, hora_fin);
      if (!disponible) return res.status(409).json({ error: 'Ese horario ya esta reservado o se superpone con otra reserva' });

      const [cancha] = await db.query('SELECT id, nombre, precio_hora FROM canchas WHERE id = ? AND activo = TRUE', [cancha_id]);
      if (cancha.length === 0) return res.status(404).json({ error: 'Cancha no encontrada' });

      const horas = Math.max(1, (parseInt(hora_fin.split(':')[0]) - parseInt(hora_inicio.split(':')[0])));
      const total = parseFloat(cancha[0].precio_hora) * horas;

      let montoCupon = 0;
      if (cupon_codigo && cupon_monto_aplicar) {
        const cupon = await cuponService.consultarSaldo(cupon_codigo);
        if (!cupon) return res.status(400).json({ error: 'El cupón ingresado no existe' });
        if (cupon.estado !== 'activo') return res.status(400).json({ error: 'El cupón no está activo o ya está agotado' });
        montoCupon = Math.round(parseFloat(cupon_monto_aplicar) * 100) / 100;
        if (Number.isNaN(montoCupon) || montoCupon <= 0) return res.status(400).json({ error: 'Monto de cupón inválido' });
        if (montoCupon > cupon.saldo + 0.01) return res.status(400).json({ error: 'El monto solicitado supera el saldo del cupón' });
        if (montoCupon > total + 0.01) return res.status(400).json({ error: 'El monto del cupón supera el precio total de la reserva' });
      }

      const [usuario] = await db.query('SELECT email FROM usuarios WHERE id = ?', [usuario_id]);
      if (usuario.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

      // 100% Coupon payment check
      if (montoCupon > 0 && Math.abs(montoCupon - total) < 0.01) {
        const conn = await db.getConnection();
        try {
          await conn.beginTransaction();

          const [ocupado] = await conn.query(
            'SELECT id FROM reservas WHERE cancha_id = ? AND fecha = ? AND estado != "cancelada" AND hora_inicio < ? AND hora_fin > ? FOR UPDATE',
            [cancha_id, fecha, hora_fin, hora_inicio]
          );
          if (ocupado.length > 0) {
            await conn.rollback();
            return res.status(409).json({ error: 'Ese horario ya esta reservado' });
          }

          const anio = new Date(fecha).getFullYear();
          const [crows] = await conn.query('SELECT COUNT(*) as total FROM reservas WHERE YEAR(created_at) = ?', [anio]);
          const num = String(crows[0].total + 1).padStart(3, '0');
          const codigo = 'RES-' + anio + '-' + num;

          const [result] = await conn.query(
            `INSERT INTO reservas (codigo, cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estado, origen, notas, cliente_nombre, cliente_dni)
             VALUES (?, ?, ?, ?, ?, ?, "confirmada", "linea", ?, ?, ?)`,
            [codigo, cancha_id, usuario_id, fecha, hora_inicio, hora_fin, notas || null, cliente_nombre.trim(), cliente_dni]
          );
          const reservaId = result.insertId;

          // Apply coupon
          await cuponService.aplicarCupon(conn, {
            codigo: cupon_codigo,
            montoSolicitado: total,
            reservaId,
            registradoPor: usuario_id
          });

          // Insert payment record
          const [pagoResult] = await conn.query(
            'INSERT INTO pagos (reserva_id, monto, metodo, estado, tipo_pago, referencia, registrado_por) VALUES (?, ?, "cupon", "pagado", "completo", ?, NULL)',
            [reservaId, total, cupon_codigo]
          );
          const pagoId = pagoResult.insertId;

          // Insert payment movement
          await conn.query(
            'INSERT INTO pagos_movimientos (pago_id, caja_turno_id, metodo, monto, referencia, registrado_por) VALUES (?, NULL, "cupon", ?, ?, NULL)',
            [pagoId, total, cupon_codigo]
          );

          await conn.commit();

          // Send email
          try {
            await enviarConfirmacionReserva(usuario[0].email, {
              nombre: cliente_nombre.trim(),
              codigo,
              cancha: cancha[0].nombre || '',
              fecha,
              horaInicio: String(hora_inicio).substring(0, 5),
              horaFin: String(hora_fin).substring(0, 5),
              monto: total
            });
          } catch (mailErr) { console.error('Error email cupón 100%:', mailErr.message); }

          return res.json({ success: true, codigo });
        } catch (err) {
          await conn.rollback();
          throw err;
        } finally {
          conn.release();
        }
      }

      // Partial payment or no coupon
      const montoRestante = Math.round((total - montoCupon) * 100) / 100;

      const [pendienteResult] = await db.query(
        `INSERT INTO reservas_pendientes_pago
           (commerce_order, usuario_id, cancha_id, fecha, hora_inicio, hora_fin, cliente_nombre, cliente_dni, notas, monto, estado, cupon_codigo, cupon_monto)
         VALUES ('', ?, ?, ?, ?, ?, ?, ?, ?, ?, "pendiente", ?, ?)`,
        [usuario_id, cancha_id, fecha, hora_inicio, hora_fin, cliente_nombre.trim(), cliente_dni, notas || null, total, cupon_codigo || null, montoCupon > 0 ? montoCupon : null]
      );
      const pendienteId = pendienteResult.insertId;
      const commerceOrder = 'PSC-P' + pendienteId + '-' + Date.now();
      await db.query('UPDATE reservas_pendientes_pago SET commerce_order = ? WHERE id = ?', [commerceOrder, pendienteId]);

      const params = {
        commerceOrder,
        subject        : 'Reserva cancha S/' + montoRestante + ' - Pacific Sport Center',
        currency       : 'PEN',
        amount         : montoRestante,
        email          : usuario[0].email,
        paymentMethod  : 9,
        urlConfirmation: process.env.FLOW_URL_CONFIRMACION,
        urlReturn      : process.env.BACKEND_URL + '/api/pagos/flow/retorno-web'
      };
      const response = await flowPost('payment/create', params);
      const urlPago  = response.url + '?token=' + response.token;
      await db.query('UPDATE reservas_pendientes_pago SET token = ? WHERE id = ?', [response.token, pendienteId]);
      res.json({ url: urlPago, token: response.token });
    } catch (err) {
      console.error('Error en Flow crear:', err?.response?.data || err?.message || err);
      res.status(500).json({ error: 'Error al crear orden de pago' });
    }
  }

  // Webhook servidor-a-servidor de Flow (urlConfirmation). Es la fuente de verdad.
  async confirmar(req, res) {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    try {
      await confirmarPendientePorToken(token);
      res.status(200).send('OK'); // Flow solo espera 200, siempre respondemos OK para que no reintente indefinidamente
    } catch (err) {
      console.error('Error en Flow confirmar:', err?.response?.data || err?.message || err);
      res.status(500).send('Error');
    }
  }

  // Retorno del navegador tras pagar. NO confia en la URL: vuelve a preguntarle
  // a Flow por el estado real del pago antes de mostrar exito.
  async retornoWeb(req, res) {
    const token = req.body.token || req.query.token;
    const frontendUrl = process.env.FRONTEND_URL || 'https://proyecto-agile-alquile-de-canchas.onrender.com';
    if (!token) return res.redirect(frontendUrl + '/pago-exitoso.html?status=error');
    try {
      const resultado = await confirmarPendientePorToken(token);
      if (resultado.ok) {
        return res.redirect(frontendUrl + '/pago-exitoso.html?codigo=' + encodeURIComponent(resultado.codigo) + '&status=success');
      }
      if (resultado.motivo === 'horario_ya_no_disponible') {
        return res.redirect(frontendUrl + '/pago-exitoso.html?status=conflicto');
      }
      return res.redirect(frontendUrl + '/pago-exitoso.html?status=no_pagado');
    } catch (err) {
      console.error('Error retornoWeb:', err?.message || err);
      res.redirect(frontendUrl + '/pago-exitoso.html?status=error');
    }
  }

  async estado(req, res) {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    try {
      const response = await flowGet('payment/getStatus', { token });
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: 'Error al consultar estado' });
    }
  }
}

module.exports = new FlowController();
