'use strict';
const bcrypt = require('bcryptjs');
const db     = require('../db/connection');
const { validarUsuarioCreate } = require('../validators/usuarioValidator');

class UsuarioController {
  async getAll(req, res) {
    try {
      const [usuarios] = await db.query(
        'SELECT id, nombre, email, rol, telefono, dni, activo, created_at FROM usuarios WHERE activo = TRUE ORDER BY created_at DESC'
      );
      res.json(usuarios);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener usuarios' });
    }
  }

  async getById(req, res) {
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
  }

  async create(req, res) {
    const validacion = validarUsuarioCreate(req.body);
    if (!validacion.valido) return res.status(400).json({ error: validacion.error });

    const { nombre, email, password, rol, telefono, dni } = req.body;
    try {
      const [existeEmail] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
      if (existeEmail.length > 0) return res.status(409).json({ error: 'El correo ya esta registrado' });

      const [existeDni] = await db.query('SELECT id FROM usuarios WHERE dni = ?', [dni]);
      if (existeDni.length > 0) return res.status(409).json({ error: 'El DNI ya esta registrado' });

      const hash = await bcrypt.hash(password, 10);
      const [result] = await db.query(
        'INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, dni) VALUES (?, ?, ?, ?, ?, ?)',
        [nombre.trim(), email, hash, rol, telefono, dni]
      );
      res.status(201).json({ message: 'Usuario creado', id: result.insertId });
    } catch (err) {
      console.error('Error en create usuario:', err);
      res.status(500).json({ error: 'Error al crear usuario' });
    }
  }

  async update(req, res) {
    const { nombre, telefono, dni, rol, activo } = req.body;
    try {
      const [actual] = await db.query('SELECT id, rol, activo FROM usuarios WHERE id = ?', [req.params.id]);
      if (actual.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (activo === false && actual[0].rol === 'admin') {
        const [admins] = await db.query('SELECT COUNT(*) AS total FROM usuarios WHERE rol = "admin" AND activo = TRUE AND id != ?', [req.params.id]);
        const [selfActive] = await db.query('SELECT activo FROM usuarios WHERE id = ?', [req.params.id]);
        if (parseInt(admins[0].total, 10) === 0 && selfActive[0].activo) {
          return res.status(400).json({ error: 'No se puede desactivar la unica cuenta de gerente activa' });
        }
      }

      if (dni) {
        const [dup] = await db.query('SELECT id FROM usuarios WHERE dni = ? AND id != ?', [dni, req.params.id]);
        if (dup.length > 0) return res.status(409).json({ error: 'El DNI ya esta registrado' });
      }

      await db.query(
        'UPDATE usuarios SET nombre = COALESCE(?, nombre), telefono = COALESCE(?, telefono), dni = COALESCE(?, dni), rol = COALESCE(?, rol), activo = COALESCE(?, activo) WHERE id = ?',
        [nombre, telefono, dni, rol, activo, req.params.id]
      );
      res.json({ message: 'Usuario actualizado' });
    } catch (err) {
      res.status(500).json({ error: 'Error al actualizar usuario' });
    }
  }

  async buscar(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Parametro de busqueda requerido' });
    try {
      const [rows] = await db.query(
        'SELECT id, nombre, email, telefono, dni, rol FROM usuarios WHERE (nombre LIKE ? OR dni = ? OR email LIKE ?) AND activo = TRUE LIMIT 10',
        ['%' + q + '%', q, '%' + q + '%']
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Error al buscar usuarios' });
    }
  }

  async delete(req, res) {
    const { id } = req.params;
    try {
      const [userRows] = await db.query('SELECT id, rol FROM usuarios WHERE id = ?', [id]);
      if (userRows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      const targetUser = userRows[0];
      if (targetUser.rol === 'admin') {
        return res.status(400).json({ error: 'No se puede eliminar a un administrador / gerente' });
      }
      
      // Borrado lógico (activo = FALSE)
      await db.query('UPDATE usuarios SET activo = FALSE WHERE id = ?', [id]);
      res.json({ ok: true, message: 'Usuario eliminado correctamente' });
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
  }
}

module.exports = new UsuarioController();
