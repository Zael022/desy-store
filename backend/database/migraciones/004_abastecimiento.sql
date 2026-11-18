-- =====================================================================
-- Migración 004: solicitudes de abastecimiento a proveedores
-- Estados: pendiente -> aceptada | rechazada (responde el proveedor)
--          aceptada  -> recibida (la tienda; genera las entradas de inventario)
--          pendiente o aceptada -> cancelada (la tienda)
-- =====================================================================

CREATE TABLE IF NOT EXISTS solicitudes_abastecimiento (
  id_solicitud         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_proveedor         INT UNSIGNED NOT NULL,
  id_usuario_creador   INT UNSIGNED NOT NULL,
  estado               ENUM('pendiente', 'aceptada', 'rechazada', 'recibida', 'cancelada') NOT NULL DEFAULT 'pendiente',
  nota_tienda          VARCHAR(255) NULL,
  comentario_proveedor VARCHAR(255) NULL,
  creada_en            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  respondida_en        DATETIME     NULL,
  id_usuario_recibio   INT UNSIGNED NULL,
  recibida_en          DATETIME     NULL,
  CONSTRAINT pk_solicitudes_abastecimiento PRIMARY KEY (id_solicitud),
  CONSTRAINT fk_solicitudes_proveedores FOREIGN KEY (id_proveedor)
    REFERENCES proveedores (id_proveedor) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_solicitudes_creador FOREIGN KEY (id_usuario_creador)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_solicitudes_recibio FOREIGN KEY (id_usuario_recibio)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_solicitudes_proveedor_estado (id_proveedor, estado),
  INDEX idx_solicitudes_fecha (creada_en)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS detalle_solicitudes_abastecimiento (
  id_detalle_solicitud INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_solicitud         INT UNSIGNED NOT NULL,
  id_producto          INT UNSIGNED NOT NULL,
  cantidad             INT          NOT NULL,
  CONSTRAINT pk_detalle_solicitudes PRIMARY KEY (id_detalle_solicitud),
  CONSTRAINT uq_detalle_solicitudes_producto UNIQUE (id_solicitud, id_producto),
  CONSTRAINT ck_detalle_solicitudes_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_detalle_solicitudes_solicitudes FOREIGN KEY (id_solicitud)
    REFERENCES solicitudes_abastecimiento (id_solicitud) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_detalle_solicitudes_productos FOREIGN KEY (id_producto)
    REFERENCES productos (id_producto) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_detalle_solicitudes_producto (id_producto)
) ENGINE = InnoDB;

-- Las entradas que genera una solicitud recibida quedan vinculadas a ella.
ALTER TABLE movimientos ADD COLUMN id_solicitud INT UNSIGNED NULL;
ALTER TABLE movimientos ADD INDEX idx_movimientos_solicitud (id_solicitud);
ALTER TABLE movimientos ADD CONSTRAINT fk_movimientos_solicitudes FOREIGN KEY (id_solicitud)
  REFERENCES solicitudes_abastecimiento (id_solicitud) ON DELETE RESTRICT ON UPDATE RESTRICT;
