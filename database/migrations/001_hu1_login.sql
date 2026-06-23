-- Migración HU-1: Inicio de sesión
-- Ejecutar en TiDB Cloud SQL Editor ANTES de hacer deploy del backend

-- 1. Nuevas columnas en usuarios (bloqueo por intentos fallidos)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS login_intentos  INT      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloqueado_hasta DATETIME;

-- 2. Tabla de auditoría de sesiones
CREATE TABLE IF NOT EXISTS audit_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT,
  email       VARCHAR(150),
  accion      VARCHAR(50)   NOT NULL,
  ip          VARCHAR(45),
  user_agent  VARCHAR(255),
  resultado   ENUM('exitoso', 'fallido') NOT NULL,
  detalle     VARCHAR(255),
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de tokens revocados (logout seguro)
CREATE TABLE IF NOT EXISTS tokens_revocados (
  jti         VARCHAR(64)   PRIMARY KEY,
  expiry      DATETIME      NOT NULL
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_audit_email   ON audit_log(email);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_tokens_expiry ON tokens_revocados(expiry);
