const rateLimit = require('express-rate-limit');

// Para endpoints de autenticación — más estricto
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                   // máximo 10 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos. Intenta nuevamente en 15 minutos.'
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

module.exports = { authLimiter, generalLimiter };
