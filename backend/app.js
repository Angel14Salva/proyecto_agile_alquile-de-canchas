require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const authRoutes    = require('./routes/auth');
const canchaRoutes  = require('./routes/canchas');
const reservaRoutes = require('./routes/reservas');
const usuarioRoutes = require('./routes/usuarios');
const pagoRoutes    = require('./routes/pagos');
const { authLimiter, generalLimiter } = require('./middleware/rateLimiter');

const app  = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────
// Seguridad: headers HTTP
// ──────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ──────────────────────────────────────────
// CORS — solo acepta peticiones del frontend
// ──────────────────────────────────────────
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ──────────────────────────────────────────
// Body parser
// ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('../frontend'));

// ──────────────────────────────────────────
// Rate limiting general
// ──────────────────────────────────────────
app.use(generalLimiter);

// ──────────────────────────────────────────
// Health check — para UptimeRobot / Render
// ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ──────────────────────────────────────────
// Rutas de la API
// ──────────────────────────────────────────
app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api/canchas',  canchaRoutes);
app.use('/api/reservas', reservaRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/pagos',    pagoRoutes);

// ──────────────────────────────────────────
// Ruta no encontrada
// ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ──────────────────────────────────────────
// Manejo global de errores
// ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ──────────────────────────────────────────
// Iniciar servidor
// ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
