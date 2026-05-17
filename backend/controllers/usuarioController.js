const db     = require('../db/connection');
const bcrypt = require('bcryptjs');

// ──────────────────────────────────────────
// GET /api/usuarios — solo admin
// ──────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const { nombre, dni, rol } = req.query;
    let query = 'SELECT id, nombre, email, rol, telefono, dni, activo, created_at FROM usuarios WHERE 1=1';
    const params = [];

    if (nombre) { query += ' AND nombre LIKE ?';  params.push(`%${nombre}%`); }
    if (dni)    { query += ' AND dni = ?';         params.push(dni); }
    if (rol)    { query += ' AND rol = ?';         params.push(rol); }

    query += ' ORDER BY created_at DESC';
    const [usuarios] = await db.query(query, params);
    res.json(usuarios);
  } catch (err) {
    console.error('Error en getAll usuarios:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

// ──────────────────────────────────────────
// GET /api/usuarios/:id
// ──────────────────────────────────────────
const getById = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nombre, email, rol, telefono, dni, activo, created_at FROM usuarios WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
};

// ──────────────────────────────────────────
// POST /api/usuarios — admin crea recepcionista o cliente
// ──────────────────────────────────────────
const create = async (req, res) => {
  const { nombre, email, password, rol, telefono, dni } = req.body;

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: 'Nombre, email, contraseña y rol son requeridos' });
  }
  if (!['admin', 'recepcionista', 'cliente'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  try {
    const [existe] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existe.length > 0) return res.status(409).json({ error: 'El email ya está registrado' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, dni) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, email, hash, rol, telefono || null, dni || null]
    );

    res.status(201).json({ message: 'Usuario creado', id: result.insertId });
  } catch (err) {
    console.error('Error en create usuario:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

// ──────────────────────────────────────────
// PUT /api/usuarios/:id
// ──────────────────────────────────────────
const update = async (req, res) => {
  const { nombre, telefono, dni, rol, activo } = req.body;

  try {
    await db.query(
      `UPDATE usuarios SET
        nombre   = COALESCE(?, nombre),
        telefono = COALESCE(?, telefono),
        dni      = COALESCE(?, dni),
        rol      = COALESCE(?, rol),
        activo   = COALESCE(?, activo)
       WHERE id = ?`,
      [nombre, telefono, dni, rol, activo, req.params.id]
    );
    res.json({ message: 'Usuario actualizado' });
  } catch (err) {
    console.error('Error en update usuario:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

// ──────────────────────────────────────────
// GET /api/usuarios/buscar?q=nombre_o_dni
// ──────────────────────────────────────────
const buscar = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });

  try {
    const [rows] = await db.query(
      `SELECT id, nombre, email, telefono, dni, rol
       FROM usuarios
       WHERE (nombre LIKE ? OR dni = ? OR email LIKE ?) AND activo = TRUE
       LIMIT 10`,
      [`%${q}%`, q, `%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar usuarios' });
  }
};

module.exports = { getAll, getById, create, update, buscar };
