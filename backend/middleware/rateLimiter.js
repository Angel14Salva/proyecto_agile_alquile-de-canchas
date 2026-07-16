const rateLimit = require('express-rate-limit');

// Para endpoints de autenticación — más estricto
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 99999,                   // sin límite
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos. Intenta nuevamente en 15 minutos.'
  }
});

// Para forgot-password y reset-password — muy estricto (evita abuso de envío de correos)
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 99999,                    // sin límite
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de recuperación. Intenta nuevamente en 15 minutos.'
  }
});

// Para el resto de la API
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100,                 // 100 peticiones por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas peticiones. Intenta en un momento.'
  }
});

module.exports = { authLimiter, generalLimiter, passwordResetLimiter };
