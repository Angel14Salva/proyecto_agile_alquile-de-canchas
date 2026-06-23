'use strict';
const db = require('./connection');

// Se ejecuta al arrancar el servidor.
// Usa IF NOT EXISTS en todo — seguro de ejecutar múltiples veces.
async function runMigrations() {
  const migrations = [
    `ALTER TABLE usuarios
       ADD COLUMN IF NOT EXISTS login_intentos  INT      NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS bloqueado_hasta DATETIME`,

    `ALTER TABLE usuarios
       ADD COLUMN IF NOT EXISTS reset_token        VARCHAR(255),
       ADD COLUMN IF NOT EXISTS reset_token_expiry DATETIME`,

    `CREATE TABLE IF NOT EXISTS audit_log (
       id          INT AUTO_INCREMENT PRIMARY KEY,
       usuario_id  INT,
       email       VARCHAR(150),
       accion      VARCHAR(50)   NOT NULL,
       ip          VARCHAR(45),
       user_agent  VARCHAR(255),
       resultado   ENUM('exitoso','fallido') NOT NULL,
       detalle     VARCHAR(255),
       created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS tokens_revocados (
       jti    VARCHAR(64) PRIMARY KEY,
       expiry DATETIME    NOT NULL
     )`,

    `CREATE INDEX IF NOT EXISTS idx_audit_email   ON audit_log(email)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_tokens_expiry ON tokens_revocados(expiry)`,
  ];

  for (const sql of migrations) {
    try {
      await db.query(sql);
    } catch (err) {
      // TiDB/MySQL puede lanzar error si el índice ya existe aunque use IF NOT EXISTS
      // Solo loguear, nunca bloquear el arranque
      if (!err.message?.includes('Duplicate')) {
        console.warn('[migrations] Advertencia:', err.message);
      }
    }
  }
  console.log('[migrations] OK');
}

module.exports = runMigrations;
