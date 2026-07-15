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

    // Fix pago pasarela: la reserva ya NO se crea hasta que Flow confirma el pago.
    // Mientras el cliente paga, los datos quedan aquí (no bloquean el horario).
    `CREATE TABLE IF NOT EXISTS reservas_pendientes_pago (
       id             INT AUTO_INCREMENT PRIMARY KEY,
       commerce_order VARCHAR(60)   NOT NULL UNIQUE,
       usuario_id     INT           NOT NULL,
       cancha_id      INT           NOT NULL,
       fecha          DATE          NOT NULL,
       hora_inicio    TIME          NOT NULL,
       hora_fin       TIME          NOT NULL,
       cliente_nombre VARCHAR(100)  NOT NULL,
       cliente_dni    CHAR(8)       NOT NULL,
       notas          TEXT          NULL,
       monto          DECIMAL(8,2)  NOT NULL,
       token          VARCHAR(100)  NULL,
       estado         ENUM('pendiente','confirmado','fallido','conflicto','expirado') NOT NULL DEFAULT 'pendiente',
       reserva_id     INT           NULL,
       created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
       FOREIGN KEY (cancha_id)  REFERENCES canchas(id)  ON DELETE RESTRICT,
       FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE SET NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_pendientes_estado ON reservas_pendientes_pago(estado)`,
    `CREATE INDEX IF NOT EXISTS idx_pendientes_slot ON reservas_pendientes_pago(cancha_id, fecha, hora_inicio)`,

    // Apertura/cierre de caja (recepción)
    `CREATE TABLE IF NOT EXISTS caja_turnos (
       id                INT AUTO_INCREMENT PRIMARY KEY,
       estado            ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta',
       monto_inicial     DECIMAL(10,2) NOT NULL DEFAULT 0,
       abierta_por       INT NOT NULL,
       abierta_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       cerrada_por       INT NULL,
       cerrada_at        DATETIME NULL,
       efectivo_esperado DECIMAL(10,2) NULL,
       efectivo_contado  DECIMAL(10,2) NULL,
       diferencia        DECIMAL(10,2) NULL,
       notas_cierre      TEXT NULL,
       FOREIGN KEY (abierta_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
       FOREIGN KEY (cerrada_por) REFERENCES usuarios(id) ON DELETE SET NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_caja_estado ON caja_turnos(estado)`,

    // Detalle real de cada cobro registrado por recepción (permite pago
    // "híbrido": una reserva pagada en partes con métodos distintos, sin
    // perder el desglose exacto que necesita el cuadre de caja).
    `CREATE TABLE IF NOT EXISTS pagos_movimientos (
       id             INT AUTO_INCREMENT PRIMARY KEY,
       pago_id        INT NOT NULL,
       caja_turno_id  INT NULL,
       metodo         ENUM('efectivo','transferencia','yape','plin','tarjeta','flow') NOT NULL,
       monto          DECIMAL(8,2) NOT NULL,
       referencia     VARCHAR(100) NULL,
       registrado_por INT NULL,
       created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE RESTRICT,
       FOREIGN KEY (caja_turno_id) REFERENCES caja_turnos(id) ON DELETE SET NULL,
       FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_pagomov_caja ON pagos_movimientos(caja_turno_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pagomov_metodo ON pagos_movimientos(metodo)`,

    // 'mixto' cuando una reserva termina pagada con mas de un metodo distinto
    `ALTER TABLE pagos MODIFY COLUMN metodo ENUM('efectivo','transferencia','yape','plin','tarjeta','flow','mixto') NOT NULL`,

    // HU: Cupones de reembolso excepcional
    `ALTER TABLE pagos_movimientos MODIFY COLUMN metodo ENUM('efectivo','transferencia','yape','plin','tarjeta','flow','cupon') NOT NULL`,
    `ALTER TABLE pagos MODIFY COLUMN metodo ENUM('efectivo','transferencia','yape','plin','tarjeta','flow','mixto','cupon') NOT NULL`,
    `ALTER TABLE pagos MODIFY COLUMN reembolso_metodo ENUM('efectivo','transferencia','cupon') NULL`,
    `CREATE TABLE IF NOT EXISTS cupones (
       id                INT AUTO_INCREMENT PRIMARY KEY,
       codigo            VARCHAR(20)   NOT NULL UNIQUE,
       valor_inicial     DECIMAL(8,2)  NOT NULL,
       saldo             DECIMAL(8,2)  NOT NULL,
       motivo            VARCHAR(255)  NOT NULL,
       reserva_origen_id INT           NOT NULL,
       generado_por      INT           NOT NULL,
       estado            ENUM('activo','agotado','anulado') NOT NULL DEFAULT 'activo',
       created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       FOREIGN KEY (reserva_origen_id) REFERENCES reservas(id) ON DELETE RESTRICT,
       FOREIGN KEY (generado_por)      REFERENCES usuarios(id) ON DELETE RESTRICT
     )`,
    `CREATE TABLE IF NOT EXISTS cupones_movimientos (
       id            INT AUTO_INCREMENT PRIMARY KEY,
       cupon_id      INT           NOT NULL,
       reserva_id    INT           NULL,
       monto         DECIMAL(8,2)  NOT NULL,
       tipo          ENUM('emision','canje','anulacion') NOT NULL,
       registrado_por INT          NULL,
       created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (cupon_id)   REFERENCES cupones(id)  ON DELETE RESTRICT,
       FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE SET NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_cupones_estado ON cupones(estado)`,
    `ALTER TABLE reservas_pendientes_pago ADD COLUMN IF NOT EXISTS cupon_codigo VARCHAR(20) NULL`,
    `ALTER TABLE reservas_pendientes_pago ADD COLUMN IF NOT EXISTS cupon_monto DECIMAL(8,2) NULL`,
    `ALTER TABLE reservas DROP INDEX uq_cancha_slot`,
    `ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS nombre_recepcionista VARCHAR(100) NULL`
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
