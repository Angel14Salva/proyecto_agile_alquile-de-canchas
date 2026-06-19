'use strict';
const bcrypt = require('bcryptjs');
const { enviarRecuperacionPassword } = require('../services/emailService');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../db/connection');

class AuthController {
  async register(req, res) {
    const { nombre, email, password, telefono, dni } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Nombre, email y contrasena son requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'La contrasena debe tener minimo 8 caracteres' });
    try {
      const [existe] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
      if (existe.length > 0) return res.status(409).json({ error: 'El correo ya esta registrado' });
      const hash = await bcrypt.hash(password, 10);
      const [result] = await db.query('INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, dni) VALUES (?, ?, ?, "cliente", ?, ?)', [nombre, email, hash, telefono || null, dni || null]);
      const token = jwt.sign({ userId: result.insertId, email, rol: 'cliente' }, process.env.JWT_SECRET, { expiresIn: '8h' });
      res.status(201).json({ message: 'Usuario registrado correctamente', token, usuario: { id: result.insertId, nombre, email, rol: 'cliente' } });
    } catch (err) {
      console.error('Error en register:', err);
      res.status(500).json({ error: 'Error al registrar usuario' });
    }
  }
  async login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contrasena son requeridos' });
    try {
      const [rows] = await db.query('SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = ?', [email]);
      if (rows.length === 0) return res.status(401).json({ error: 'Credenciales incorrectas' });
      const usuario = rows[0];
      if (!usuario.activo) return res.status(403).json({ error: 'Tu cuenta ha sido desactivada. Contacta al administrador.' });
      const passwordValida = await bcrypt.compare(password, usuario.password_hash);
      if (!passwordValida) return res.status(401).json({ error: 'Credenciales incorrectas' });
      const token = jwt.sign({ userId: usuario.id, email: usuario.email, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '8h' });
      res.json({ message: 'Login exitoso', token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
    } catch (err) {
      console.error('Error en login:', err);
      res.status(500).json({ error: 'Error al iniciar sesion' });
    }
  }
  async me(req, res) {
    try {
      const [rows] = await db.query('SELECT id, nombre, email, rol, telefono, dni, created_at FROM usuarios WHERE id = ?', [req.user.userId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener perfil' });
    }
  }
  async forgotPassword(req, res) {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });
    try {
      const [rows] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
      if (rows.length === 0) return res.json({ message: 'Si el correo existe, recibiras instrucciones en breve.' });
      const token  = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 30 * 60 * 1000);
      await db.query('UPDATE usuarios SET reset_token = ?, reset_token_expiry = ? WHERE email = ?', [token, expiry, email]);
      // Enviar correo con el token
      const resetUrl = (process.env.FRONTEND_URL || 'https://pacific-sport-frontend.onrender.com') + '/reset-password.html?token=' + token;
      try {
        const [urows] = await db.query('SELECT nombre FROM usuarios WHERE email = ?', [email]);
        await enviarRecuperacionPassword(email, { nombre: urows[0]?.nombre || 'Usuario', resetUrl });
      } catch(mailErr) { console.error('Error enviando correo recuperacion:', mailErr.message); }
      res.json({ message: 'Si el correo existe, recibiras instrucciones en breve.' });
    } catch (err) {
      console.error('Error en forgotPassword:', err);
      res.status(500).json({ error: 'Error al procesar solicitud' });
    }
  }
  async resetPassword(req, res) {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token y contrasena requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'Minimo 8 caracteres' });
    try {
      const [rows] = await db.query('SELECT id FROM usuarios WHERE reset_token = ? AND reset_token_expiry > NOW()', [token]);
      if (rows.length === 0) return res.status(400).json({ error: 'Token invalido o expirado' });
      const hash = await bcrypt.hash(password, 10);
      await db.query('UPDATE usuarios SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', [hash, rows[0].id]);
      res.json({ message: 'Contrasena actualizada correctamente' });
    } catch (err) {
      console.error('Error en resetPassword:', err);
      res.status(500).json({ error: 'Error al resetear contrasena' });
    }
  }
}

module.exports = new AuthController();
