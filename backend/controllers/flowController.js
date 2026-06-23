'use strict';

const FlowApi = require('flowcl-node-api-client');
const db      = require('../db/connection');

console.log("FLOW ENV:", process.env.FLOW_API_KEY?.substring(0,8), process.env.FLOW_SECRET_KEY?.substring(0,8));
const flowConfig = {
  apiKey    : process.env.FLOW_API_KEY,
  secretKey : process.env.FLOW_SECRET_KEY,
  apiURL    : process.env.FLOW_API_URL
};

class FlowController {

  // POST /api/pagos/flow/crear
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
      const flowApi = new FlowApi(flowConfig);

      const params = {
        commerceOrder : 'PSC-' + reserva_id + '-' + Date.now(),
        subject       : 'Reserva ' + r.codigo + ' - Pacific Sport Center',
        currency      : 'CLP',
        amount        : Math.round(parseFloat(r.precio_hora)),
        email         : r.email,
        paymentMethod : 11,
        urlConfirmation: process.env.FLOW_URL_CONFIRMACION,
        urlReturn     : process.env.FLOW_URL_RETORNO + '?reserva=' + reserva_id + '&status=success'
      };

      const response = await flowApi.send('payment/create', params, 'POST');
      const urlPago  = response.url + '?token=' + response.token;

      res.json({ url: urlPago, token: response.token });
    } catch (err) {
      console.error('Error en Flow crear:', err?.message || err);
      res.status(500).json({ error: 'Error al crear orden de pago' });
    }
  }

  // POST /api/pagos/flow/confirmar (webhook de Flow)
  async confirmar(req, res) {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    try {
      const flowApi  = new FlowApi(flowConfig);
      const response = await flowApi.send('payment/getStatus', { token }, 'GET');

      if (response.status === 2) {
        // Pago aprobado
        const commerceOrder = response.commerceOrder;
        const reserva_id    = parseInt(commerceOrder.split('-')[1]);

        const [cancha] = await db.query(
          'SELECT c.precio_hora FROM reservas r JOIN canchas c ON r.cancha_id = c.id WHERE r.id = ?',
          [reserva_id]
        );

        const [pagoExiste] = await db.query('SELECT id FROM pagos WHERE reserva_id = ?', [reserva_id]);

        if (pagoExiste.length === 0) {
          await db.query(
            'INSERT INTO pagos (reserva_id, monto, metodo, estado, referencia) VALUES (?, ?, "flow", "pagado", ?)',
            [reserva_id, cancha[0]?.precio_hora || 0, token]
          );
        }

        await db.query('UPDATE reservas SET estado = "confirmada" WHERE id = ?', [reserva_id]);
      }

      res.status(200).send('OK');
    } catch (err) {
      console.error('Error en Flow confirmar:', err);
      res.status(500).send('Error');
    }
  }

  // GET /api/pagos/flow/estado?token=xxx
  async estado(req, res) {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    try {
      const flowApi  = new FlowApi(flowConfig);
      const response = await flowApi.send('payment/getStatus', { token }, 'GET');
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: 'Error al consultar estado' });
    }
  }
}

module.exports = new FlowController();
