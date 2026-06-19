require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');

const authRoutes    = require('./routes/auth');
const canchaRoutes  = require('./routes/canchas');
const reservaRoutes = require('./routes/reservas');
const flowRoutes    = require('./routes/flow');
const usuarioRoutes = require('./routes/usuarios');
const pagoRoutes    = require('./routes/pagos');
const reservaGrandeRoutes = require('./routes/reservasGrandes');
const { authLimiter, generalLimiter } = require('./middleware/rateLimiter');

const app  = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(generalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api/canchas',  canchaRoutes);
app.use('/api/reservas', reservaRoutes);
app.use('/api/pagos/flow', flowRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/pagos',    pagoRoutes);
app.use('/api/reservas-grandes', reservaGrandeRoutes);

app.get('*.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', req.path), (err) => {
    if (err) res.status(404).json({ error: 'Página no encontrada' });
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});