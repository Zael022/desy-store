-- =====================================================================
-- Migración 005: configuraciones generales (solo la dueña las cambia)
-- El stock máximo (67) NO está aquí: sigue en backend/src/config/constantes.js.
-- =====================================================================

CREATE TABLE IF NOT EXISTS configuracion (
  clave                VARCHAR(50)  NOT NULL,
  valor                VARCHAR(255) NOT NULL,
  descripcion          VARCHAR(255) NOT NULL,
  actualizado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  id_usuario_actualizo INT UNSIGNED NULL,
  CONSTRAINT pk_configuracion PRIMARY KEY (clave),
  CONSTRAINT fk_configuracion_usuarios FOREIGN KEY (id_usuario_actualizo)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;

-- Valores iniciales (INSERT IGNORE: si ya existen, no se tocan).
INSERT IGNORE INTO configuracion (clave, valor, descripcion) VALUES
  ('umbral_pocas_unidades', '5', 'Con esta cantidad o menos, el catálogo dice "pocas unidades" y el panel muestra una alerta de stock bajo.'),
  ('proveedor_ve_stock', 'false', 'Si es true, los proveedores ven el stock exacto de sus productos, si es false, solo la disponibilidad.'),
  ('mensaje_catalogo', 'Bisutería y accesorios hechos con cariño. Consulte la disponibilidad en tienda.', 'Mensaje que ven los clientes en el catálogo.');
