'use strict';
const crypto = require('crypto');
const axios  = require('axios');
const db     = require('../db/connection');

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

class FlowController {
  async crear(req, res) {
    const { reserva_id } = req.body;
    if (!reserva_id) return res.status(400).json({ error: 'reserva_id requerido' });
    try {
      const [reserva] = await db.query(
        'SELECT r.*, c.precio_hora, u.email FROM reservas r JOIN canchas c ON r.cancha_id = c.id JOIN usuarios u ON r.usuario_id = u.id WHERE r.id = ?',
        [reserva_id]
      );
      if (reserva.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });
      if (reserva[0].estado === 'cancelada') return res.status(400).json({ error: 'Reserva cancelada' });
      const r = reserva[0];
      const params = {
        commerceOrder : 'PSC-' + reserva_id + '-' + Date.now(),
        subject       : 'Reserva ' + r.codigo + ' S/' + r.precio_hora + ' - Pacific Sport Center',
        currency      : 'PEN',
        amount        : 2,
        email         : r.email,
        paymentMethod : 9,
        urlConfirmation: process.env.FLOW_URL_CONFIRMACION,
        urlReturn     : process.env.FLOW_URL_RETORNO + '?reserva=' + reserva_id + '&status=success'
      };
      const response = await flowPost('payment/create', params);
      const urlPago  = response.url + '?token=' + response.token;
      res.json({ url: urlPago, token: response.token });
    } catch (err) {
      console.error('Error en Flow crear:', err?.response?.data || err?.message || err);
      res.status(500).json({ error: 'Error al crear orden de pago' });
    }
  }

  async confirmar(req, res) {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    try {
      const response = await flowGet('payment/getStatus', { token });
      if (response.status === 2) {
        const reserva_id = parseInt(response.commerceOrder.split('-')[1]);
        const [cancha] = await db.query(
          'SELECT c.precio_hora FROM reservas r JOIN canchas c ON r.cancha_id = c.id WHERE r.id = ?',
          [reserva_id]
        );
        const [pagoExiste] = await db.query('SELECT id FROM pagos WHERE reserva_id = ?', [reserva_id]);
        if (pagoExiste.length === 0) {
          await db.query(
            'INSERT INTO pagos (reserva_id, monto, metodo, estado, tipo_pago, referencia) VALUES (?, ?, "flow", "pagado", "completo", ?)',
            [reserva_id, cancha[0]?.precio_hora || 0, token]
          );
        }
        await db.query('UPDATE reservas SET estado = "confirmada" WHERE id = ?', [reserva_id]);
      }
      res.status(200).send('OK');
    } catch (err) {
      console.error('Error en Flow confirmar:', err?.response?.data || err?.message || err);
      res.status(500).send('Error');
    }
  }

  async retorno(req, res) {
    const { reserva_id } = req.body;
    if (!reserva_id) return res.status(400).json({ error: 'reserva_id requerido' });
    try {
      const [pagoExiste] = await db.query('SELECT id FROM pagos WHERE reserva_id = ?', [reserva_id]);
      if (pagoExiste.length === 0) {
        const [cancha] = await db.query(
          'SELECT c.precio_hora FROM reservas r JOIN canchas c ON r.cancha_id = c.id WHERE r.id = ?',
          [reserva_id]
        );
        await db.query(
          'INSERT INTO pagos (reserva_id, monto, metodo, estado, referencia) VALUES (?, ?, "flow", "pagado", ?)',
          [reserva_id, cancha[0]?.precio_hora || 0, 'flow-retorno-' + Date.now()]
        );
      }
      await db.query('UPDATE reservas SET estado = "confirmada" WHERE id = ?', [reserva_id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Error en retorno:', err?.message || err);
      res.status(500).json({ error: 'Error al confirmar retorno' });
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
