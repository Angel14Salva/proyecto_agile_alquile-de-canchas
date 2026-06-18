'use strict';
const db = require('../db/connection');

class ReservaController {
  async #generarCodigo() {
    const anio = new Date().getFullYear();
    const [rows] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE YEAR(created_at) = ?', [anio]);
    const num = String(rows[0].total + 1).padStart(3, '0');
    return 'RES-' + anio + '-' + num;
  }
  async getAll(req, res) {
    try {
      const { fecha, estado, cancha_id } = req.query;
      const { userId, rol } = req.user;
      let query = 'SELECT r.*, c.nombre as cancha_nombre, c.precio_hora, u.nombre as cliente_nombre, u.email as cliente_email, u.telefono as cliente_telefono, p.estado as pago_estado, p.metodo as pago_metodo, p.monto as pago_monto FROM reservas r JOIN canchas c ON r.cancha_id = c.id JOIN usuarios u ON r.usuario_id = u.id LEFT JOIN pagos p ON p.reserva_id = r.id WHERE 1=1';
      const params = [];
      if (rol === 'cliente') { query += ' AND r.usuario_id = ?'; params.push(userId); }
      if (fecha)     { query += ' AND r.fecha = ?';     params.push(fecha); }
      if (estado)    { query += ' AND r.estado = ?';    params.push(estado); }
      if (cancha_id) { query += ' AND r.cancha_id = ?'; params.push(cancha_id); }
      query += ' ORDER BY r.fecha ASC, r.hora_inicio ASC';
      const [reservas] = await db.query(query, params);
      res.json(reservas);
    } catch (err) {
      console.error('Error en getAll reservas:', err);
      res.status(500).json({ error: 'Error al obtener reservas' });
    }
  }
  async getById(req, res) {
    try {
      const [rows] = await db.query('SELECT r.*, c.nombre as cancha_nombre, c.precio_hora, u.nombre as cliente_nombre, u.email as cliente_email, p.estado as pago_estado, p.metodo as pago_metodo, p.monto as pago_monto FROM reservas r JOIN canchas c ON r.cancha_id = c.id JOIN usuarios u ON r.usuario_id = u.id LEFT JOIN pagos p ON p.reserva_id = r.id WHERE r.id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });
      if (req.user.rol === 'cliente' && rows[0].usuario_id !== req.user.userId) return res.status(403).json({ error: 'Acceso denegado' });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener reserva' });
    }
  }
  async create(req, res) {
    const { cancha_id, fecha, hora_inicio, hora_fin, notas, origen } = req.body;
    const usuario_id = req.user.userId;
    if (!cancha_id || !fecha || !hora_inicio || !hora_fin) return res.status(400).json({ error: 'Cancha, fecha, hora inicio y hora fin son requeridos' });
    const fechaReserva = new Date(fecha + 'T' + hora_inicio);
    const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const diff  = (fechaReserva - ahora) / 1000 / 60;
    if (diff < 60) return res.status(400).json({ error: 'No se puede reservar con menos de 1 hora de anticipacion' });
    try {
      const [ocupado] = await db.query('SELECT id FROM reservas WHERE cancha_id = ? AND fecha = ? AND hora_inicio = ? AND estado != "cancelada"', [cancha_id, fecha, hora_inicio]);
      if (ocupado.length > 0) return res.status(409).json({ error: 'Ese horario ya esta reservado' });
      const [cancha] = await db.query('SELECT id, precio_hora FROM canchas WHERE id = ? AND activo = TRUE', [cancha_id]);
      if (cancha.length === 0) return res.status(404).json({ error: 'Cancha no encontrada' });
      const anio = new Date().getFullYear();
      const [crows] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE YEAR(created_at) = ?', [anio]);
      const num = String(crows[0].total + 1).padStart(3, '0');
      const codigo = `RES-${anio}-${num}`;
      const [result] = await db.query('INSERT INTO reservas (codigo, cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estado, origen, notas) VALUES (?, ?, ?, ?, ?, ?, "pendiente", ?, ?)', [codigo, cancha_id, usuario_id, fecha, hora_inicio, hora_fin, origen || 'linea', notas || null]);
      res.status(201).json({ message: 'Reserva creada exitosamente', reserva_id: result.insertId, codigo, estado: 'pendiente' });
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
      await db.query('UPDATE reservas SET fecha = COALESCE(?, fecha), hora_inicio = COALESCE(?, hora_inicio), hora_fin = COALESCE(?, hora_fin), notas = COALESCE(?, notas) WHERE id = ?', [fecha, hora_inicio, hora_fin, notas, id]);
      res.json({ message: 'Reserva modificada correctamente' });
    } catch (err) {
      console.error('Error en update reserva:', err);
      res.status(500).json({ error: 'Error al modificar reserva' });
    }
  }
  async cancel(req, res) {
    const { id } = req.params;
    try {
      const [rows] = await db.query('SELECT * FROM reservas WHERE id = ?', [id]);
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
    } catch (err) {
      console.error('Error en cancel reserva:', err);
      res.status(500).json({ error: 'Error al cancelar reserva' });
    }
  }
  async generarCodigo() {
    const anio = new Date().getFullYear();
    const [rows] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE YEAR(created_at) = ?', [anio]);
    const num = String(rows[0].total + 1).padStart(3, '0');
    return 'RES-' + anio + '-' + num;
  }
}

module.exports = new ReservaController();
