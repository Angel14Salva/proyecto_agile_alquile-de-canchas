'use strict';
const crypto = require('crypto');
const axios  = require('axios');
const db     = require('../db/connection');
const { enviarConfirmacionReserva } = require('../services/emailService');

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

  const [rows] = await db.query('SELECT * FROM reservas_pendientes_pago WHERE id = ?', [pendienteId]);
  if (rows.length === 0) return { ok: false, motivo: 'pendiente_no_encontrado' };
  const pendiente = rows[0];

  // Idempotencia: si el webhook y el retorno del navegador llegan casi juntos,
  // que el segundo no intente crear la reserva de nuevo.
  if (pendiente.estado === 'confirmado' && pendiente.reserva_id) {
    const [r] = await db.query('SELECT id, codigo FROM reservas WHERE id = ?', [pendiente.reserva_id]);
    return { ok: true, yaConfirmado: true, reserva_id: pendiente.reserva_id, codigo: r[0]?.codigo };
  }

  if (response.status !== 2) {
    // 1=pendiente, 3=rechazado, 4=anulado. El cliente no pago (o aun no).
    if (pendiente.estado === 'pendiente') {
      await db.query('UPDATE reservas_pendientes_pago SET estado = "fallido", token = ? WHERE id = ?', [token, pendienteId]);
    }
    return { ok: false, motivo: 'pago_no_completado' };
  }

  // Pago confirmado por Flow. Recien AHORA se valida y se crea la reserva.
  const disponible = await horarioDisponible(pendiente.cancha_id, pendiente.fecha, pendiente.hora_inicio, pendiente.hora_fin);
  if (!disponible) {
    // Caso raro: alguien tomo el horario mientras el cliente pagaba (ej. recepcion).
    // El dinero SI se cobro en Flow -> queda marcado para revision/reembolso manual.
    await db.query('UPDATE reservas_pendientes_pago SET estado = "conflicto", token = ? WHERE id = ?', [token, pendienteId]);
    return { ok: false, motivo: 'horario_ya_no_disponible', requiereRevision: true };
  }

  const codigo = await generarCodigoReserva();
  const [result] = await db.query(
    `INSERT INTO reservas (codigo, cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estado, origen, notas, cliente_nombre, cliente_dni)
     VALUES (?, ?, ?, ?, ?, ?, "confirmada", "linea", ?, ?, ?)`,
    [codigo, pendiente.cancha_id, pendiente.usuario_id, pendiente.fecha, pendiente.hora_inicio, pendiente.hora_fin,
     pendiente.notas, pendiente.cliente_nombre, pendiente.cliente_dni]
  );
  const reserva_id = result.insertId;

  await db.query(
    'INSERT INTO pagos (reserva_id, monto, metodo, estado, tipo_pago, referencia) VALUES (?, ?, "flow", "pagado", "completo", ?)',
    [reserva_id, pendiente.monto, token]
  );
  await db.query('UPDATE reservas_pendientes_pago SET estado = "confirmado", token = ?, reserva_id = ? WHERE id = ?', [token, reserva_id, pendienteId]);

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
}

class FlowController {
  // Ya NO crea la reserva. Solo valida disponibilidad + guarda los datos como
  // "pendiente de pago" y abre la orden en Flow. La reserva se crea recien
  // cuando el pago se confirma (ver confirmarPendientePorToken).
  async crear(req, res) {
    const { cancha_id, fecha, hora_inicio, hora_fin, notas, cliente_nombre, cliente_dni } = req.body;
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

      const [cancha] = await db.query('SELECT id, precio_hora FROM canchas WHERE id = ? AND activo = TRUE', [cancha_id]);
      if (cancha.length === 0) return res.status(404).json({ error: 'Cancha no encontrada' });

      const horas = Math.max(1, (parseInt(hora_fin.split(':')[0]) - parseInt(hora_inicio.split(':')[0])));
      const monto = parseFloat(cancha[0].precio_hora) * horas;

      const [usuario] = await db.query('SELECT email FROM usuarios WHERE id = ?', [usuario_id]);
      if (usuario.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

      const [pendienteResult] = await db.query(
        `INSERT INTO reservas_pendientes_pago
           (commerce_order, usuario_id, cancha_id, fecha, hora_inicio, hora_fin, cliente_nombre, cliente_dni, notas, monto, estado)
         VALUES ('', ?, ?, ?, ?, ?, ?, ?, ?, ?, "pendiente")`,
        [usuario_id, cancha_id, fecha, hora_inicio, hora_fin, cliente_nombre.trim(), cliente_dni, notas || null, monto]
      );
      const pendienteId = pendienteResult.insertId;
      const commerceOrder = 'PSC-P' + pendienteId + '-' + Date.now();
      await db.query('UPDATE reservas_pendientes_pago SET commerce_order = ? WHERE id = ?', [commerceOrder, pendienteId]);

      const params = {
        commerceOrder,
        subject        : 'Reserva cancha S/' + monto + ' - Pacific Sport Center',
        currency       : 'PEN',
        amount         : monto,
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
