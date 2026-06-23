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

    // HU-05: datos del cliente en la reserva
    `ALTER TABLE reservas
       ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(100) NULL,
       ADD COLUMN IF NOT EXISTS cliente_dni    CHAR(8)      NULL`,

    // HU-10: auditoría de cancelación en recepción
    `ALTER TABLE reservas
       ADD COLUMN IF NOT EXISTS cancelado_por INT NULL,
       ADD COLUMN IF NOT EXISTS cancelado_at  DATETIME NULL`,

    // HU-10: tipo de pago y datos de reembolso manual
    `ALTER TABLE pagos
       ADD COLUMN IF NOT EXISTS tipo_pago ENUM('completo','adelanto') NULL,
       ADD COLUMN IF NOT EXISTS reembolso_metodo ENUM('efectivo','transferencia') NULL,
       ADD COLUMN IF NOT EXISTS reembolso_confirmado_at DATETIME NULL`,

    `CREATE TABLE IF NOT EXISTS comprobantes (
       id          INT AUTO_INCREMENT PRIMARY KEY,
       pago_id     INT           NOT NULL,
       reserva_id  INT           NOT NULL,
       tipo        ENUM('boleta','factura') NOT NULL DEFAULT 'boleta',
       numero      VARCHAR(30)   NOT NULL,
       created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
       UNIQUE KEY uq_comprobante_numero (numero),
       UNIQUE KEY uq_comprobante_pago (pago_id),
       FOREIGN KEY (pago_id)    REFERENCES pagos(id)    ON DELETE RESTRICT,
       FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE RESTRICT
     )`,

    `CREATE TABLE IF NOT EXISTS notas_credito (
       id              INT AUTO_INCREMENT PRIMARY KEY,
       comprobante_id  INT           NOT NULL,
       reserva_id      INT           NOT NULL,
       numero          VARCHAR(30)   NOT NULL,
       monto           DECIMAL(8,2)  NOT NULL,
       cancelado_por   INT           NOT NULL,
       created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
       UNIQUE KEY uq_nota_credito_numero (numero),
       FOREIGN KEY (comprobante_id) REFERENCES comprobantes(id) ON DELETE RESTRICT,
       FOREIGN KEY (reserva_id)     REFERENCES reservas(id)     ON DELETE RESTRICT,
       FOREIGN KEY (cancelado_por)  REFERENCES usuarios(id)     ON DELETE RESTRICT
     )`,

    // HU-06: notas en pagos
    `ALTER TABLE pagos ADD COLUMN IF NOT EXISTS notas TEXT NULL`,

    // HU-09: check-in
    `ALTER TABLE reservas
       ADD COLUMN IF NOT EXISTS checkin_at DATETIME NULL,
       ADD COLUMN IF NOT EXISTS checkin_por INT NULL`,

    // HU-12: reservas grandes
    `CREATE TABLE IF NOT EXISTS reservas_grandes (
       id            INT AUTO_INCREMENT PRIMARY KEY,
       codigo        VARCHAR(20) UNIQUE,
       usuario_id    INT NOT NULL,
       nombre_org    VARCHAR(150) NOT NULL,
       ruc           CHAR(11) NULL,
       fecha         DATE NOT NULL,
       turno         ENUM('manana','tarde','dia_completo') NOT NULL,
       hora_inicio   TIME NOT NULL,
       hora_fin      TIME NOT NULL,
       num_canchas   INT NOT NULL,
       precio_total  DECIMAL(10,2) NOT NULL,
       monto_pagado  DECIMAL(10,2) NOT NULL DEFAULT 0,
       estado        ENUM('pendiente','confirmada','cancelada') NOT NULL DEFAULT 'pendiente',
       origen        ENUM('linea','recepcion') NOT NULL DEFAULT 'linea',
       tipo_comprobante ENUM('boleta','factura') NULL,
       notas         TEXT NULL,
       created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
     )`,

    `CREATE TABLE IF NOT EXISTS reservas_grandes_canchas (
       id               INT AUTO_INCREMENT PRIMARY KEY,
       reserva_grande_id INT NOT NULL,
       cancha_id        INT NOT NULL,
       FOREIGN KEY (reserva_grande_id) REFERENCES reservas_grandes(id) ON DELETE CASCADE,
       FOREIGN KEY (cancha_id) REFERENCES canchas(id) ON DELETE RESTRICT,
       UNIQUE KEY uq_rg_cancha (reserva_grande_id, cancha_id)
     )`,

    // HU-14: caja mensual
    `CREATE TABLE IF NOT EXISTS caja_mensual (
       id             INT AUTO_INCREMENT PRIMARY KEY,
       anio           INT NOT NULL,
       mes            INT NOT NULL,
       monto_inicial  DECIMAL(10,2) NOT NULL DEFAULT 0,
       created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       UNIQUE KEY uq_caja_mes (anio, mes)
     )`,

    // HU-15: historial exportaciones
    `CREATE TABLE IF NOT EXISTS informes_exportados (
       id           INT AUTO_INCREMENT PRIMARY KEY,
       nombre       VARCHAR(120) NOT NULL,
       formato      ENUM('pdf','excel','csv') NOT NULL,
       desde        DATE NOT NULL,
       hasta        DATE NOT NULL,
       generado_por INT NULL,
       created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (generado_por) REFERENCES usuarios(id) ON DELETE SET NULL
     )`,

    // HU-11: estado pendiente_reembolso
    `ALTER TABLE reservas MODIFY COLUMN estado ENUM('pendiente','confirmada','cancelada','completada','pendiente_reembolso') NOT NULL DEFAULT 'pendiente'`,
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
