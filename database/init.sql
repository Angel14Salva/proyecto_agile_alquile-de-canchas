-- ============================================================
-- SISTEMA DE RESERVAS DE CANCHAS DEPORTIVAS
-- Base de datos: canchas_db
-- Compatible con: TiDB Cloud (MySQL 8.0)
-- ============================================================

CREATE DATABASE IF NOT EXISTS canchas_db;
USE canchas_db;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  rol           ENUM('admin', 'recepcionista', 'cliente') NOT NULL DEFAULT 'cliente',
  telefono      VARCHAR(20),
  activo        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS canchas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100)  NOT NULL,
  deporte       ENUM('futbol', 'basketball', 'tenis', 'volleyball', 'otro') NOT NULL,
  descripcion   TEXT,
  capacidad     INT           NOT NULL DEFAULT 10,
  precio_hora   DECIMAL(8,2)  NOT NULL,
  activo        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  cancha_id     INT           NOT NULL,
  usuario_id    INT           NOT NULL,
  fecha         DATE          NOT NULL,
  hora_inicio   TIME          NOT NULL,
  hora_fin      TIME          NOT NULL,
  estado        ENUM('pendiente', 'confirmada', 'cancelada', 'completada') NOT NULL DEFAULT 'pendiente',
  origen        ENUM('linea', 'recepcion') NOT NULL DEFAULT 'linea',
  notas         TEXT,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cancha_id)  REFERENCES canchas(id)  ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_cancha_slot (cancha_id, fecha, hora_inicio)
);

CREATE TABLE IF NOT EXISTS pagos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id    INT           NOT NULL UNIQUE,
  monto         DECIMAL(8,2)  NOT NULL,
  metodo        ENUM('efectivo', 'transferencia', 'yape', 'plin') NOT NULL,
  estado        ENUM('pendiente', 'pagado', 'reembolsado') NOT NULL DEFAULT 'pendiente',
  registrado_por INT,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reserva_id)     REFERENCES reservas(id)  ON DELETE RESTRICT,
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id)  ON DELETE SET NULL
);

CREATE INDEX idx_reservas_fecha   ON reservas(fecha);
CREATE INDEX idx_reservas_cancha  ON reservas(cancha_id);
CREATE INDEX idx_reservas_usuario ON reservas(usuario_id);
CREATE INDEX idx_reservas_estado  ON reservas(estado);
CREATE INDEX idx_pagos_estado     ON pagos(estado);

INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
('Administrador', 'admin@canchas.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

INSERT INTO canchas (nombre, deporte, descripcion, capacidad, precio_hora) VALUES
('Cancha 1 - Fútbol', 'futbol', 'Cancha de grass sintético con iluminación nocturna', 14, 80.00),
('Cancha 2 - Basketball', 'basketball', 'Cancha techada de parquet', 10, 60.00);
