const db = require('../db/connection');

// ──────────────────────────────────────────
// GET /api/canchas
// ──────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const { deporte } = req.query;
    let query = 'SELECT * FROM canchas WHERE activo = TRUE';
    const params = [];

    if (deporte) {
      query += ' AND deporte = ?';
      params.push(deporte);
    }

    query += ' ORDER BY id ASC';
    const [canchas] = await db.query(query, params);
    res.json(canchas);
  } catch (err) {
    console.error('Error en getAll canchas:', err);
    res.status(500).json({ error: 'Error al obtener canchas' });
  }
};

// ──────────────────────────────────────────
// GET /api/canchas/:id
// ──────────────────────────────────────────
const getById = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM canchas WHERE id = ? AND activo = TRUE', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Cancha no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cancha' });
  }
};

// ──────────────────────────────────────────
// GET /api/canchas/:id/disponibilidad?fecha=YYYY-MM-DD
// ──────────────────────────────────────────
const getDisponibilidad = async (req, res) => {
  const { fecha } = req.query;
  const { id }    = req.params;

  if (!fecha) return res.status(400).json({ error: 'Fecha requerida (YYYY-MM-DD)' });

  try {
    const [cancha] = await db.query(
      'SELECT hora_apertura, hora_cierre, precio_hora FROM canchas WHERE id = ? AND activo = TRUE',
      [id]
    );
    if (cancha.length === 0) return res.status(404).json({ error: 'Cancha no encontrada' });

    const [reservas] = await db.query(
      'SELECT hora_inicio FROM reservas WHERE cancha_id = ? AND fecha = ? AND estado != "cancelada"',
      [id, fecha]
    );

    const horasOcupadas = reservas.map(r => r.hora_inicio.substring(0, 5));

    // Generar slots de 1 hora entre apertura y cierre
    const apertura = parseInt(cancha[0].hora_apertura.substring(0, 2));
    const cierre   = parseInt(cancha[0].hora_cierre.substring(0, 2));
    const slots = [];

    for (let h = apertura; h < cierre; h++) {
      const hora = `${String(h).padStart(2, '0')}:00`;
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
};

// ──────────────────────────────────────────
// POST /api/canchas — solo admin
// ──────────────────────────────────────────
const create = async (req, res) => {
  const { nombre, deporte, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre } = req.body;

  if (!nombre || !deporte || !precio_hora) {
    return res.status(400).json({ error: 'Nombre, deporte y precio son requeridos' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO canchas (nombre, deporte, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nombre, deporte, descripcion || null, capacidad || 10, precio_hora,
       hora_apertura || '07:00:00', hora_cierre || '23:00:00']
    );
    res.status(201).json({ message: 'Cancha creada', id: result.insertId });
  } catch (err) {
    console.error('Error en create cancha:', err);
    res.status(500).json({ error: 'Error al crear cancha' });
  }
};

// ──────────────────────────────────────────
// PUT /api/canchas/:id — solo admin
// ──────────────────────────────────────────
const update = async (req, res) => {
  const { nombre, deporte, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre, activo } = req.body;

  try {
    await db.query(
      `UPDATE canchas SET
        nombre        = COALESCE(?, nombre),
        deporte       = COALESCE(?, deporte),
        descripcion   = COALESCE(?, descripcion),
        capacidad     = COALESCE(?, capacidad),
        precio_hora   = COALESCE(?, precio_hora),
        hora_apertura = COALESCE(?, hora_apertura),
        hora_cierre   = COALESCE(?, hora_cierre),
        activo        = COALESCE(?, activo)
      WHERE id = ?`,
      [nombre, deporte, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre, activo, req.params.id]
    );
    res.json({ message: 'Cancha actualizada' });
  } catch (err) {
    console.error('Error en update cancha:', err);
    res.status(500).json({ error: 'Error al actualizar cancha' });
  }
};

module.exports = { getAll, getById, getDisponibilidad, create, update };
