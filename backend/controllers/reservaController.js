'use strict';
const db = require('../db/connection');
const { enviarConfirmacionReserva, enviarCancelacionReserva } = require('../services/emailService');
const cancelacionService = require('../services/cancelacionService');
const cancelacionLineaService = require('../services/cancelacionLineaService');
const { validarBusquedaCancelacion } = require('../validators/cancelacionValidator');

class ReservaController {
  async #generarCodigo() {
    const anio = new Date().getFullYear();
    const [rows] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE YEAR(created_at) = ?', [anio]);
    const num = String(rows[0].total + 1).padStart(3, '0');
    return 'RES-' + anio + '-' + num;
  }
  async getAll(req, res) {
    try {
      const { fecha, estado, cancha_id, desde, hasta } = req.query;
      const { userId, rol } = req.user;
      let query = `SELECT r.*, c.nombre as cancha_nombre, c.precio_hora, u.nombre as usuario_nombre,
        u.email as cliente_email, u.telefono as cliente_telefono,
        p.estado as pago_estado, p.metodo as pago_metodo, p.monto as pago_monto, p.tipo_pago,
        ur.nombre as recepcionista_nombre
        FROM reservas r
        JOIN canchas c ON r.cancha_id = c.id
        JOIN usuarios u ON r.usuario_id = u.id
        LEFT JOIN pagos p ON p.reserva_id = r.id
        LEFT JOIN usuarios ur ON p.registrado_por = ur.id
        WHERE 1=1`;
      const params = [];
      if (rol === 'cliente') {
        query += ' AND r.usuario_id = ?';
        params.push(userId);
        query += ' AND r.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
      }
      if (fecha)     { query += ' AND r.fecha = ?'; params.push(fecha); }
      if (desde)     { query += ' AND r.fecha >= ?'; params.push(desde); }
      if (hasta)     { query += ' AND r.fecha <= ?'; params.push(hasta); }
      if (estado)    { query += ' AND r.estado = ?'; params.push(estado); }
      if (cancha_id) { query += ' AND r.cancha_id = ?'; params.push(cancha_id); }
      query += ' ORDER BY r.id DESC';
      const [reservas] = await db.query(query, params);
      reservas.forEach(r => {
        r.cliente_nombre = r.cliente_nombre || r.usuario_nombre;
        delete r.usuario_nombre;
      });
      res.json(reservas);
    } catch (err) {
      console.error('Error en getAll reservas:', err);
      res.status(500).json({ error: 'Error al obtener reservas' });
    }
  }
  async getById(req, res) {
    try {
      const [rows] = await db.query('SELECT r.*, c.nombre as cancha_nombre, c.precio_hora, u.nombre as usuario_nombre, u.email as cliente_email, p.estado as pago_estado, p.metodo as pago_metodo, p.monto as pago_monto FROM reservas r JOIN canchas c ON r.cancha_id = c.id JOIN usuarios u ON r.usuario_id = u.id LEFT JOIN pagos p ON p.reserva_id = r.id WHERE r.id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });
      if (req.user.rol === 'cliente' && rows[0].usuario_id !== req.user.userId) return res.status(403).json({ error: 'Acceso denegado' });
      const row = rows[0];
      row.cliente_nombre = row.cliente_nombre || row.usuario_nombre;
      delete row.usuario_nombre;
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener reserva' });
    }
  }
  async create(req, res) {
    const { cancha_id, fecha, hora_inicio, hora_fin, notas, cliente_nombre, cliente_dni } = req.body;
    const usuario_id = req.user.userId;
    const rol        = req.user.rol;

    if (!cancha_id || !fecha || !hora_inicio || !hora_fin)
      return res.status(400).json({ error: 'Cancha, fecha, hora inicio y hora fin son requeridos' });

    // Validar nombre y DNI del cliente (obligatorios para todos los roles)
    if (!cliente_nombre || !cliente_nombre.trim())
      return res.status(400).json({ error: 'El nombre del cliente es requerido' });
    if (!cliente_dni || !/^\d{8}$/.test(cliente_dni))
      return res.status(400).json({ error: 'El DNI debe tener exactamente 8 dígitos numéricos' });

    const ahora       = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const fechaReserva = new Date(fecha + 'T' + hora_inicio);
    const diffMin     = (fechaReserva - ahora) / 1000 / 60;
    if (diffMin < 60 && rol === 'cliente')
      return res.status(400).json({ error: 'No se puede reservar con menos de 1 hora de anticipacion' });

    // Límite: máximo 30 días desde hoy
    const limite = new Date(ahora);
    limite.setDate(limite.getDate() + 30);
    limite.setHours(23, 59, 59, 999);
    if (fechaReserva > limite)
      return res.status(400).json({ error: 'Solo se pueden reservar canchas con hasta 7 días de anticipación' });

    // Origen según rol del usuario autenticado
    const origenFinal = (rol === 'recepcionista' || rol === 'admin') ? 'recepcion' : 'linea';

    try {
      const [ocupado] = await db.query(
        'SELECT id FROM reservas WHERE cancha_id = ? AND fecha = ? AND estado != "cancelada" AND hora_inicio < ? AND hora_fin > ?',
        [cancha_id, fecha, hora_fin, hora_inicio]
      );
      if (ocupado.length > 0) return res.status(409).json({ error: 'Ese horario ya esta reservado o se superpone con otra reserva' });

      const [cancha] = await db.query('SELECT id, precio_hora FROM canchas WHERE id = ? AND activo = TRUE', [cancha_id]);
      if (cancha.length === 0) return res.status(404).json({ error: 'Cancha no encontrada' });

      const anio = new Date().getFullYear();
      const [crows] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE YEAR(created_at) = ?', [anio]);
      const num    = String(crows[0].total + 1).padStart(3, '0');
      const codigo = `RES-${anio}-${num}`;

      const [result] = await db.query(
        'INSERT INTO reservas (codigo, cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estado, origen, notas, cliente_nombre, cliente_dni) VALUES (?, ?, ?, ?, ?, ?, "pendiente", ?, ?, ?, ?)',
        [codigo, cancha_id, usuario_id, fecha, hora_inicio, hora_fin, origenFinal, notas || null, cliente_nombre.trim(), cliente_dni]
      );

      res.status(201).json({ message: 'Reserva creada exitosamente', reserva_id: result.insertId, codigo, estado: 'pendiente' });

      // Enviar correo de confirmación
      try {
        const [urows]  = await db.query('SELECT nombre, email FROM usuarios WHERE id = ?', [usuario_id]);
        const [crows2] = await db.query('SELECT nombre FROM canchas WHERE id = ?', [cancha_id]);
        if (urows.length > 0) {
          await enviarConfirmacionReserva(urows[0].email, {
            nombre:     cliente_nombre.trim(),
            codigo,
            cancha:     crows2[0]?.nombre || '',
            fecha,
            horaInicio: hora_inicio.substring(0, 5),
            horaFin:    hora_fin.substring(0, 5),
            monto:      cancha[0].precio_hora
          });
        }
      } catch(mailErr) { console.error('Error enviando correo:', mailErr.message); }

    } catch (err) {
      console.error('Error en create reserva:', err);
      res.status(500).json({ error: 'Error al crear reserva' });
    }
  }
  async update(req, res) {
    const { fecha, hora_inicio, hora_fin, notas } = req.body;
    const { id } = req.params;
    try {
      const [rows] = await db.query('SELECT * FROM reservas WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });
      const reserva = rows[0];
      if (req.user.rol === 'cliente' && reserva.usuario_id !== req.user.userId) return res.status(403).json({ error: 'Acceso denegado' });
      if (reserva.estado === 'cancelada' || reserva.estado === 'completada') return res.status(400).json({ error: 'No se puede modificar una reserva cancelada o completada' });
      const fechaReserva = new Date(reserva.fecha + 'T' + reserva.hora_inicio);
      const diff = (fechaReserva - new Date()) / 1000 / 60 / 60;
      if (diff < 2) return res.status(400).json({ error: 'No se puede modificar con menos de 2 horas de anticipacion' });
      let horaFin = hora_fin;
      if (hora_inicio && !hora_fin) {
        const [h, m] = hora_inicio.split(':').map(Number);
        const fin = new Date(0, 0, 0, h + 1, m);
        horaFin = fin.getHours().toString().padStart(2,'0') + ':' + fin.getMinutes().toString().padStart(2,'0') + ':00';
      }
      await db.query('UPDATE reservas SET fecha = COALESCE(?, fecha), hora_inicio = COALESCE(?, hora_inicio), hora_fin = COALESCE(?, hora_fin), notas = COALESCE(?, notas) WHERE id = ?', [fecha, hora_inicio, horaFin, notas, id]);
      res.json({ message: 'Reserva modificada correctamente' });
    } catch (err) {
      console.error('Error en update reserva:', err);
      res.status(500).json({ error: 'Error al modificar reserva' });
    }
  }
  async cancel(req, res) {
    const { id } = req.params;
    try {
      const [rows] = await db.query(
        `SELECT r.*, c.nombre AS cancha_nombre, u.email AS cliente_email, u.nombre AS usuario_nombre
         FROM reservas r
         JOIN canchas c ON r.cancha_id = c.id
         JOIN usuarios u ON r.usuario_id = u.id
         WHERE r.id = ?`,
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });
      const reserva = rows[0];
      if (req.user.rol === 'cliente' && reserva.usuario_id !== req.user.userId) return res.status(403).json({ error: 'Acceso denegado' });
      if (reserva.estado === 'cancelada') return res.status(400).json({ error: 'La reserva ya esta cancelada' });
      if (req.user.rol === 'cliente') {
        const fechaReserva = new Date(reserva.fecha + 'T' + reserva.hora_inicio);
        const diff = (fechaReserva - new Date()) / 1000 / 60 / 60;
        if (diff < 2) return res.status(400).json({ error: 'No se puede cancelar con menos de 2 horas de anticipacion' });
      }
      await db.query('UPDATE reservas SET estado = "cancelada" WHERE id = ?', [id]);
      res.json({ message: 'Reserva cancelada correctamente' });
      try {
        await enviarCancelacionReserva(reserva.cliente_email, {
          nombre: reserva.cliente_nombre || reserva.usuario_nombre,
          codigo: reserva.codigo,
          cancha: reserva.cancha_nombre || '',
          fecha: reserva.fecha?.toISOString?.().substring(0, 10) || String(reserva.fecha).substring(0, 10),
          horaInicio: String(reserva.hora_inicio).substring(0, 5),
          horaFin: String(reserva.hora_fin).substring(0, 5)
        });
      } catch (mailErr) { console.error('Error enviando correo cancelacion:', mailErr.message); }
    } catch (err) {
      console.error('Error en cancel reserva:', err);
      res.status(500).json({ error: 'Error al cancelar reserva' });
    }
  }

  async buscarCancelacion(req, res) {
    const validacion = validarBusquedaCancelacion(req.query.q);
    if (!validacion.valido) return res.status(validacion.status).json({ error: validacion.error });

    try {
      const reservas = await cancelacionService.buscarReservas(validacion.termino);
      if (reservas.length === 0) return res.status(404).json({ error: 'No se encontraron reservas con ese criterio' });
      res.json(reservas);
    } catch (err) {
      console.error('Error en buscarCancelacion:', err);
      res.status(500).json({ error: 'Error al buscar reservas' });
    }
  }

  async cancelarRecepcion(req, res) {
    const { id } = req.params;
    const { reembolso_confirmado, reembolso_metodo } = req.body || {};

    try {
      const resultado = await cancelacionService.cancelarRecepcion(parseInt(id, 10), {
        reembolsoConfirmado: Boolean(reembolso_confirmado),
        reembolsoMetodo: reembolso_metodo || null,
        canceladoPorUserId: req.user.userId
      });

      if (!resultado.ok) {
        return res.status(resultado.status).json({ error: resultado.error });
      }

      res.json({
        message: resultado.message,
        reserva: resultado.reserva,
        nota_credito: resultado.nota_credito,
        monto_reembolsado: resultado.monto_reembolsado
      });
    } catch (err) {
      console.error('Error en cancelarRecepcion:', err);
      res.status(500).json({ error: 'Error al cancelar reserva' });
    }
  }
  async cancelarLineaPreview(req, res) {
    try {
      const resultado = await cancelacionLineaService.preview(parseInt(req.params.id, 10), req.user.userId);
      if (!resultado.ok) return res.status(resultado.status || 404).json({ error: resultado.error });
      res.json(resultado);
    } catch (err) {
      res.status(500).json({ error: 'Error al consultar cancelacion' });
    }
  }

  async cancelarLinea(req, res) {
    try {
      const resultado = await cancelacionLineaService.cancelar(parseInt(req.params.id, 10), req.user.userId);
      if (!resultado.ok) return res.status(resultado.status || 400).json({ error: resultado.error });
      res.json(resultado);
    } catch (err) {
      console.error('Error cancelar linea:', err);
      res.status(500).json({ error: 'Error al cancelar reserva' });
    }
  }

  async generarCodigo() {
    const anio = new Date().getFullYear();
    const [rows] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE YEAR(created_at) = ?', [anio]);
    const num = String(rows[0].total + 1).padStart(3, '0');
    return 'RES-' + anio + '-' + num;
  }
  async getByCode(req, res) {
    try {
      const { codigo } = req.params;
      const [rows] = await db.query(
        'SELECT r.*, c.nombre as cancha_nombre, c.precio_hora, u.nombre as usuario_nombre, u.email as cliente_email, p.estado as pago_estado, p.metodo as pago_metodo, p.monto as pago_monto FROM reservas r JOIN canchas c ON r.cancha_id = c.id JOIN usuarios u ON r.usuario_id = u.id LEFT JOIN pagos p ON p.reserva_id = r.id WHERE r.codigo = ?',
        [codigo]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });
      const row = rows[0];
      row.cliente_nombre = row.cliente_nombre || row.usuario_nombre;
      delete row.usuario_nombre;
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'Error al buscar reserva' });
    }
  }
}

module.exports = new ReservaController();
