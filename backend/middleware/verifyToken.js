const jwt = require('jsonwebtoken');
const db  = require('../db/connection');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token no proporcionado' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que el token no haya sido revocado (logout)
    if (decoded.jti) {
      const [rows] = await db.query('SELECT jti FROM tokens_revocados WHERE jti = ?', [decoded.jti]);
      if (rows.length > 0)
        return res.status(401).json({ error: 'Token revocado. Inicia sesión nuevamente.' });
    }

    // Verificar que el usuario exista y siga activo en el sistema (no esté eliminado/desactivado)
    const [userRows] = await db.query('SELECT id, activo FROM usuarios WHERE id = ?', [decoded.userId]);
    if (userRows.length === 0 || !userRows[0].activo) {
      return res.status(401).json({ error: 'El usuario ya no existe o su cuenta ha sido eliminada.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expirado' });
    return res.status(401).json({ error: 'Token inválido' });
  }
};

module.exports = verifyToken;
