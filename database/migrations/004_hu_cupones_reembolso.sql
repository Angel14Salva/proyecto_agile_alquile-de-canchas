-- HU: Cupones de reembolso excepcional
-- Crear tablas 'cupones' y 'cupones_movimientos' y alterar 'pagos', 'pagos_movimientos' y 'reservas_pendientes_pago'

ALTER TABLE pagos_movimientos MODIFY COLUMN metodo ENUM('efectivo','transferencia','yape','plin','tarjeta','flow','cupon') NOT NULL;
ALTER TABLE pagos MODIFY COLUMN metodo ENUM('efectivo','transferencia','yape','plin','tarjeta','flow','mixto','cupon') NOT NULL;
ALTER TABLE pagos MODIFY COLUMN reembolso_metodo ENUM('efectivo','transferencia','cupon') NULL;

CREATE TABLE IF NOT EXISTS cupones (
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
);

CREATE TABLE IF NOT EXISTS cupones_movimientos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  cupon_id      INT           NOT NULL,
  reserva_id    INT           NULL,
  monto         DECIMAL(8,2)  NOT NULL,
  tipo          ENUM('emision','canje','anulacion') NOT NULL,
  registrado_por INT          NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cupon_id)   REFERENCES cupones(id)  ON DELETE RESTRICT,
  FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cupones_estado ON cupones(estado);

ALTER TABLE reservas_pendientes_pago ADD COLUMN IF NOT EXISTS cupon_codigo VARCHAR(20) NULL;
ALTER TABLE reservas_pendientes_pago ADD COLUMN IF NOT EXISTS cupon_monto DECIMAL(8,2) NULL;
