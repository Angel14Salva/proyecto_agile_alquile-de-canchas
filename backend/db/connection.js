const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host    : process.env.DB_HOST,
  port    : parseInt(process.env.DB_PORT) || 4000,
  user    : process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl     : process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: true },  // Obligatorio en TiDB Cloud; desactivable con DB_SSL=false para MySQL local
  waitForConnections: true,
  connectionLimit   : 10,
  queueLimit        : 0
});

// Verificar conexión al iniciar
pool.getConnection()
  .then(conn => {
    console.log('Conectado a TiDB Cloud correctamente');
    conn.release();
  })
  .catch(err => {
    console.error('Error al conectar con la base de datos:', err.message);
    process.exit(1);
  });

module.exports = pool;
