// Uso: router.get('/ruta', verifyToken, checkRole('admin'), controller)
// Roles disponibles: 'admin' (dueño), 'recepcionista', 'cliente'

const checkRole = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}`
      });
    }

    next();
  };
};

module.exports = checkRole;
