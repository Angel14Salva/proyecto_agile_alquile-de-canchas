USE canchas_db;

DROP TABLE IF EXISTS pagos;
DROP TABLE IF EXISTS reservas;
DROP TABLE IF EXISTS canchas;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  nombre              VARCHAR(100)  NOT NULL,
  email               VARCHAR(150)  NOT NULL UNIQUE,
  password_hash       VARCHAR(255)  NOT NULL,
  rol                 ENUM('admin', 'recepcionista', 'cliente') NOT NULL DEFAULT 'cliente',
  telefono            VARCHAR(20),
  dni                 VARCHAR(15),
  activo              BOOLEAN       NOT NULL DEFAULT TRUE,
  reset_token         VARCHAR(255),
  reset_token_expiry  DATETIME,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE canchas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100)  NOT NULL,
  deporte       ENUM('futbol', 'basketball', 'volleyball') NOT NULL,
  descripcion   TEXT,
  capacidad     INT           NOT NULL DEFAULT 10,
  precio_hora   DECIMAL(8,2)  NOT NULL,
  hora_apertura TIME          NOT NULL DEFAULT '07:00:00',
  hora_cierre   TIME          NOT NULL DEFAULT '23:00:00',
  activo        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE reservas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  codigo        VARCHAR(20)   UNIQUE,
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

CREATE TABLE pagos (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id     INT           NOT NULL UNIQUE,
  monto          DECIMAL(8,2)  NOT NULL,
  metodo         ENUM('efectivo', 'transferencia', 'yape', 'plin', 'tarjeta') NOT NULL,
  estado         ENUM('pendiente', 'pagado', 'reembolsado') NOT NULL DEFAULT 'pendiente',
  referencia     VARCHAR(100),
  registrado_por INT,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reserva_id)     REFERENCES reservas(id)  ON DELETE RESTRICT,
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id)  ON DELETE SET NULL
);

CREATE INDEX idx_reservas_fecha   ON reservas(fecha);
CREATE INDEX idx_reservas_cancha  ON reservas(cancha_id);
CREATE INDEX idx_reservas_usuario ON reservas(usuario_id);
CREATE INDEX idx_reservas_estado  ON reservas(estado);
CREATE INDEX idx_pagos_estado     ON pagos(estado);

INSERT INTO usuarios (nombre, email, password_hash, rol, telefono) VALUES
('Administrador', 'admin@canchas.com',     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',        '999000001'),
('Recepcionista', 'recepcion@canchas.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'recepcionista','999000002'),
('Cliente Demo',  'cliente@canchas.com',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cliente',      '999000003');

INSERT INTO canchas (nombre, deporte, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre) VALUES
('Cancha 1 - Fútbol',      'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 2 - Fútbol',      'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 3 - Fútbol',      'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 4 - Fútbol',      'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 5 - Fútbol',      'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 6 - Fútbol',      'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 7 - Fútbol',      'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 8 - Fútbol',      'futbol',     'Cancha de grass sintético con iluminación nocturna. Vestuarios incluidos.', 14, 80.00, '07:00:00', '23:00:00'),
('Cancha 9 - Basketball',  'basketball', 'Cancha de cemento techada con tableros profesionales.',                     10, 50.00, '08:00:00', '22:00:00'),
('Cancha 10 - Volleyball', 'volleyball', 'Cancha de cemento para volleyball con red reglamentaria.',                  12, 40.00, '08:00:00', '22:00:00');
