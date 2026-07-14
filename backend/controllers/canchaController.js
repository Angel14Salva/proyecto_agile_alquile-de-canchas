'use strict';
const db = require('../db/connection');
const { validarCanchaPayload } = require('../validators/canchaValidator');

class CanchaController {
  async getAll(req, res) {
    try {
      const { deporte, incluir_inactivas } = req.query;
      const esAdmin = req.user?.rol === 'admin' && incluir_inactivas === 'true';
      let query = esAdmin ? 'SELECT * FROM canchas WHERE 1=1' : 'SELECT * FROM canchas WHERE activo = TRUE';
      const params = [];
      if (deporte) { query += ' AND deporte = ?'; params.push(deporte); }
      query += ' ORDER BY id ASC';
      const [canchas] = await db.query(query, params);
      res.json(canchas);
    } catch (err) {
      console.error('Error en getAll canchas:', err);
      res.status(500).json({ error: 'Error al obtener canchas' });
    }
  }

  async getAllPublic(req, res) {
    try {
      const { deporte } = req.query;
      let query = 'SELECT * FROM canchas WHERE activo = TRUE';
      const params = [];
      if (deporte) { query += ' AND deporte = ?'; params.push(deporte); }
      query += ' ORDER BY id ASC';
      const [canchas] = await db.query(query, params);
      res.json(canchas);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener canchas' });
    }
  }

  async getAllAdmin(req, res) {
    try {
      const [canchas] = await db.query('SELECT * FROM canchas ORDER BY id ASC');
      res.json(canchas);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener canchas' });
    }
  }

  async getById(req, res) {
    try {
      const [rows] = await db.query('SELECT * FROM canchas WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Cancha no encontrada' });
      if (!rows[0].activo && req.user?.rol !== 'admin') {
        return res.status(404).json({ error: 'Cancha no encontrada' });
      }
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener cancha' });
    }
  }

  async getDisponibilidad(req, res) {
    const { fecha } = req.query;
    const { id } = req.params;
    if (!fecha) return res.status(400).json({ error: 'Fecha requerida (YYYY-MM-DD)' });
    try {
      const [cancha] = await db.query('SELECT hora_apertura, hora_cierre, precio_hora FROM canchas WHERE id = ? AND activo = TRUE', [id]);
      if (cancha.length === 0) return res.status(404).json({ error: 'Cancha no encontrada' });

      const [reservas] = await db.query(
        'SELECT hora_inicio FROM reservas WHERE cancha_id = ? AND fecha = ? AND estado NOT IN ("cancelada","pendiente_reembolso")',
        [id, fecha]
      );

      const horasOcupadas = reservas.map(r => r.hora_inicio.substring(0, 5));
      const apertura = parseInt(cancha[0].hora_apertura.substring(0, 2));
      const cierre = parseInt(cancha[0].hora_cierre.substring(0, 2));
      const slots = [];
      for (let h = apertura; h < cierre; h++) {
        const hora = String(h).padStart(2, '0') + ':00';
        slots.push({
          hora,
          disponible: !horasOcupadas.includes(hora),
          precio: cancha[0].precio_hora
        });
      }
      res.json({ fecha, slots, precio_hora: cancha[0].precio_hora });
    } catch (err) {
      console.error('Error en getDisponibilidad:', err);
      res.status(500).json({ error: 'Error al obtener disponibilidad' });
    }
  }

  async create(req, res) {
    const validacion = validarCanchaPayload(req.body);
    if (!validacion.valido) return res.status(400).json({ error: validacion.error });
    const { nombre, deporte, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre } = req.body;
    if (!deporte) return res.status(400).json({ error: 'Deporte es requerido' });
    try {
      const [duplicado] = await db.query('SELECT id FROM canchas WHERE LOWER(nombre) = LOWER(?)', [nombre]);
      if (duplicado.length > 0) return res.status(400).json({ error: 'Ya existe una cancha con ese nombre' });
      const [result] = await db.query(
        'INSERT INTO canchas (nombre, deporte, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nombre, deporte, descripcion || null, capacidad || 10, precio_hora, hora_apertura || '07:00:00', hora_cierre || '23:00:00']
      );
      res.status(201).json({ message: 'Cancha creada', id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: 'Error al crear cancha' });
    }
  }

  async update(req, res) {
    const validacion = validarCanchaPayload(req.body, true);
    if (!validacion.valido) return res.status(400).json({ error: validacion.error });
    const { nombre, deporte, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre, activo } = req.body;
    try {
      const [existe] = await db.query('SELECT id FROM canchas WHERE id = ?', [req.params.id]);
      if (existe.length === 0) return res.status(404).json({ error: 'Cancha no encontrada' });
      await db.query(
        'UPDATE canchas SET nombre = COALESCE(?, nombre), deporte = COALESCE(?, deporte), descripcion = COALESCE(?, descripcion), capacidad = COALESCE(?, capacidad), precio_hora = COALESCE(?, precio_hora), hora_apertura = COALESCE(?, hora_apertura), hora_cierre = COALESCE(?, hora_cierre), activo = COALESCE(?, activo) WHERE id = ?',
        [nombre, deporte, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre, activo, req.params.id]
      );
      res.json({ message: 'Cancha actualizada' });
    } catch (err) {
      res.status(500).json({ error: 'Error al actualizar cancha' });
    }
  }
}

module.exports = new CanchaController();
