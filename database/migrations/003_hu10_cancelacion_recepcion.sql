-- HU-10: Cancelar reserva desde recepción
-- Auditoría, comprobantes y notas de crédito

ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS cancelado_por INT NULL,
  ADD COLUMN IF NOT EXISTS cancelado_at  DATETIME NULL;

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS tipo_pago ENUM('completo','adelanto') NULL,
  ADD COLUMN IF NOT EXISTS reembolso_metodo ENUM('efectivo','transferencia') NULL,
  ADD COLUMN IF NOT EXISTS reembolso_confirmado_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS comprobantes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  pago_id     INT           NOT NULL,
  reserva_id  INT           NOT NULL,
  tipo        ENUM('boleta','factura') NOT NULL DEFAULT 'boleta',
  numero      VARCHAR(30)   NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comprobante_numero (numero),
  UNIQUE KEY uq_comprobante_pago (pago_id)
);

CREATE TABLE IF NOT EXISTS notas_credito (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  comprobante_id  INT           NOT NULL,
  reserva_id      INT           NOT NULL,
  numero          VARCHAR(30)   NOT NULL,
  monto           DECIMAL(8,2)  NOT NULL,
  cancelado_por   INT           NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_nota_credito_numero (numero)
);
