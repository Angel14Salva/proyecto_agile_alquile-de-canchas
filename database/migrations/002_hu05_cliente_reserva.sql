-- HU-05: Agregar datos del cliente a la reserva
-- Permite vincular nombre y DNI del cliente aunque la reserva la cree un recepcionista

ALTER TABLE reservas
  ADD COLUMN cliente_nombre VARCHAR(100) NULL AFTER notas,
  ADD COLUMN cliente_dni    CHAR(8)      NULL AFTER cliente_nombre;
