USE canchas_db;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS dni                VARCHAR(15)  AFTER telefono,
  ADD COLUMN IF NOT EXISTS reset_token        VARCHAR(255) AFTER activo,
  ADD COLUMN IF NOT EXISTS reset_token_expiry DATETIME     AFTER reset_token;

ALTER TABLE canchas
  ADD COLUMN IF NOT EXISTS hora_apertura TIME NOT NULL DEFAULT '08:00:00' AFTER precio_hora,
  ADD COLUMN IF NOT EXISTS hora_cierre   TIME NOT NULL DEFAULT '22:00:00' AFTER hora_apertura;

ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) AFTER id;

ALTER TABLE pagos
  MODIFY COLUMN metodo ENUM('efectivo', 'transferencia', 'yape', 'plin', 'tarjeta') NOT NULL,
  ADD COLUMN IF NOT EXISTS referencia VARCHAR(100) AFTER estado;

DELETE FROM canchas;
DELETE FROM usuarios;

INSERT INTO usuarios (nombre, email, password_hash, rol, telefono) VALUES
('Administrador', 'admin@canchas.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '999000001');

INSERT INTO canchas (nombre, deporte, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre) VALUES
('Cancha 1 - Fútbol',     'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 2 - Fútbol',     'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 3 - Fútbol',     'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 4 - Fútbol',     'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 5 - Fútbol',     'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 6 - Fútbol',     'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 7 - Fútbol',     'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 8 - Fútbol',     'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 9 - Basketball',  'basketball', 'Cancha de cemento techada con tableros profesionales.',                    10, 50.00, '08:00:00', '22:00:00'),
('Cancha 10 - Volleyball', 'volleyball', 'Cancha de cemento para volleyball con red reglamentaria.',                 12, 40.00, '08:00:00', '22:00:00');

SELECT id, nombre, deporte, precio_hora, hora_apertura, hora_cierre FROM canchas;
SELECT id, nombre, email, rol FROM usuarios;
