'use strict';
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../db/connection');
const { enviarRecuperacionPassword } = require('../services/emailService');

const MAX_INTENTOS   = 5;
const BLOQUEO_MIN    = 30;

// ── helpers ──────────────────────────────────────────────────────────────────

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
}

async function registrarAudit(req, { usuarioId = null, email = '', accion, resultado, detalle = '' }) {
  try {
    await db.query(
      'INSERT INTO audit_log (usuario_id, email, accion, ip, user_agent, resultado, detalle) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [usuarioId, email, accion, getIp(req), req.headers['user-agent'] || '', resultado, detalle]
    );
  } catch { /* no bloquear el flujo principal por un error de log */ }
}

function generarToken(usuario) {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    { userId: usuario.id, email: usuario.email, rol: usuario.rol, jti },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  return { token, jti };
}

// ── Controller ────────────────────────────────────────────────────────────────

class AuthController {

  async register(req, res) {
    const { nombre, email, password, telefono, dni } = req.body;
    if (!nombre || !email || !password)
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    if (password.length < 8)
      return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
    try {
      const [existe] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
      if (existe.length > 0)
        return res.status(409).json({ error: 'El correo ya está registrado' });
      const hash = await bcrypt.hash(password, 10);
      const [result] = await db.query(
        'INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, dni) VALUES (?, ?, ?, "cliente", ?, ?)',
        [nombre, email, hash, telefono || null, dni || null]
      );
      const { token } = generarToken({ id: result.insertId, email, rol: 'cliente' });
      await registrarAudit(req, { usuarioId: result.insertId, email, accion: 'register', resultado: 'exitoso' });
      res.status(201).json({ message: 'Usuario registrado correctamente', token, usuario: { id: result.insertId, nombre, email, rol: 'cliente' } });
    } catch (err) {
      console.error('Error en register:', err);
      res.status(500).json({ error: 'Error al registrar usuario' });
    }
  }

  async login(req, res) {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });

    try {
      const [rows] = await db.query(
        'SELECT id, nombre, email, password_hash, rol, activo, login_intentos, bloqueado_hasta FROM usuarios WHERE email = ?',
        [email]
      );

      // Correo no registrado — mismo mensaje genérico para no revelar existencia
      if (rows.length === 0) {
        await registrarAudit(req, { email, accion: 'login', resultado: 'fallido', detalle: 'correo no registrado' });
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      const usuario = rows[0];

      // Cuenta desactivada
      if (!usuario.activo)
        return res.status(403).json({ error: 'Tu cuenta ha sido desactivada. Contacta al administrador.' });

      // Verificar bloqueo activo
      if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
        const hasta = new Date(usuario.bloqueado_hasta).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        await registrarAudit(req, { usuarioId: usuario.id, email, accion: 'login', resultado: 'fallido', detalle: 'cuenta bloqueada' });
        return res.status(403).json({ error: `Cuenta bloqueada por demasiados intentos fallidos. Intenta nuevamente después de las ${hasta}.` });
      }

      const passwordValida = await bcrypt.compare(password, usuario.password_hash);

      if (!passwordValida) {
        const nuevosIntentos = (usuario.login_intentos || 0) + 1;
        const bloqueado = nuevosIntentos >= MAX_INTENTOS;
        const bloqueadoHasta = bloqueado
          ? new Date(Date.now() + BLOQUEO_MIN * 60 * 1000)
          : null;

        await db.query(
          'UPDATE usuarios SET login_intentos = ?, bloqueado_hasta = ? WHERE id = ?',
          [bloqueado ? 0 : nuevosIntentos, bloqueadoHasta, usuario.id]
        );

        await registrarAudit(req, {
          usuarioId: usuario.id, email, accion: 'login', resultado: 'fallido',
          detalle: bloqueado ? `bloqueado tras ${MAX_INTENTOS} intentos` : `intento ${nuevosIntentos}/${MAX_INTENTOS}`
        });

        if (bloqueado)
          return res.status(403).json({ error: `Cuenta bloqueada por ${BLOQUEO_MIN} minutos tras ${MAX_INTENTOS} intentos fallidos consecutivos.` });

        const restantes = MAX_INTENTOS - nuevosIntentos;
        return res.status(401).json({ error: `Credenciales incorrectas. Te quedan ${restantes} intento${restantes === 1 ? '' : 's'} antes del bloqueo.` });
      }

      // Login exitoso — resetear contador
      await db.query('UPDATE usuarios SET login_intentos = 0, bloqueado_hasta = NULL WHERE id = ?', [usuario.id]);

      const { token } = generarToken(usuario);
      await registrarAudit(req, { usuarioId: usuario.id, email, accion: 'login', resultado: 'exitoso' });

      res.json({
        message: 'Login exitoso',
        token,
        usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
      });

    } catch (err) {
      console.error('Error en login:', err);
      res.status(500).json({ error: 'Error al iniciar sesión' });
    }
  }

  async logout(req, res) {
    try {
      const { jti, exp } = req.user;
      if (jti && exp) {
        const expiry = new Date(exp * 1000);
        await db.query('INSERT IGNORE INTO tokens_revocados (jti, expiry) VALUES (?, ?)', [jti, expiry]);
        // Limpiar tokens expirados periódicamente (oportunista, sin job externo)
        await db.query('DELETE FROM tokens_revocados WHERE expiry < NOW()');
      }
      await registrarAudit(req, { usuarioId: req.user.userId, email: req.user.email, accion: 'logout', resultado: 'exitoso' });
      res.json({ message: 'Sesión cerrada correctamente' });
    } catch (err) {
      console.error('Error en logout:', err);
      res.status(500).json({ error: 'Error al cerrar sesión' });
    }
  }

  async me(req, res) {
    try {
      const [rows] = await db.query(
        'SELECT id, nombre, email, rol, telefono, dni, created_at FROM usuarios WHERE id = ?',
        [req.user.userId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.json(rows[0]);
    } catch {
      res.status(500).json({ error: 'Error al obtener perfil' });
    }
  }

  async forgotPassword(req, res) {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });
    try {
      const [rows] = await db.query('SELECT id, nombre FROM usuarios WHERE email = ?', [email]);
      // Respuesta siempre igual para no revelar si el correo existe
      if (rows.length === 0) return res.json({ message: 'Si el correo existe, recibirás instrucciones en breve.' });

      const token  = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 30 * 60 * 1000);
      await db.query('UPDATE usuarios SET reset_token = ?, reset_token_expiry = ? WHERE email = ?', [token, expiry, email]);

      const resetUrl = (process.env.FRONTEND_URL || 'https://pacific-sport-frontend.onrender.com') + '/reset-password.html?token=' + token;
      try {
        await enviarRecuperacionPassword(email, { nombre: rows[0].nombre || 'Usuario', resetUrl });
      } catch (mailErr) {
        console.error('Error enviando correo recuperacion:', mailErr.message);
      }

      await registrarAudit(req, { usuarioId: rows[0].id, email, accion: 'forgot_password', resultado: 'exitoso' });
      res.json({ message: 'Si el correo existe, recibirás instrucciones en breve.' });
    } catch (err) {
      console.error('Error en forgotPassword:', err);
      res.status(500).json({ error: 'Error al procesar solicitud' });
    }
  }

  async resetPassword(req, res) {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token y contraseña requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        'SELECT id, email FROM usuarios WHERE reset_token = ? AND reset_token_expiry > NOW()',
        [token]
      );
      if (rows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: 'Token inválido o expirado' });
      }
      const hash = await bcrypt.hash(password, 10);
      await conn.query(
        'UPDATE usuarios SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
        [hash, rows[0].id]
      );
      await conn.commit();
      conn.release();
      await registrarAudit(req, { usuarioId: rows[0].id, email: rows[0].email, accion: 'reset_password', resultado: 'exitoso' });
      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error('Error en resetPassword:', err);
      res.status(500).json({ error: 'Error al resetear contraseña' });
    }
  }
}

module.exports = new AuthController();
