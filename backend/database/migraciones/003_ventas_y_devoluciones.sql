-- =====================================================================
-- Migración 003: costos, ventas y devoluciones
-- El detalle de cada venta guarda el precio y el costo vigentes al vender,
-- así los reportes no cambian si después se edita el producto.
-- =====================================================================

-- Costo unitario del producto (puede quedar vacío en los productos existentes).
ALTER TABLE productos ADD COLUMN costo_unitario DECIMAL(10,2) NULL AFTER precio;
ALTER TABLE productos ADD CONSTRAINT ck_productos_costo CHECK (costo_unitario IS NULL OR costo_unitario >= 0);

CREATE TABLE IF NOT EXISTS ventas (
  id_venta           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  clave_idempotencia CHAR(36)      NOT NULL,
  id_usuario         INT UNSIGNED  NOT NULL,
  id_empleado        INT UNSIGNED  NOT NULL,
  id_cliente         INT UNSIGNED  NULL,
  total              DECIMAL(12,2) NOT NULL,
  nota               VARCHAR(255)  NULL,
  fecha              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_ventas PRIMARY KEY (id_venta),
  CONSTRAINT uq_ventas_clave UNIQUE (clave_idempotencia),
  CONSTRAINT ck_ventas_total CHECK (total >= 0),
  CONSTRAINT fk_ventas_usuarios FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_ventas_empleados FOREIGN KEY (id_empleado)
    REFERENCES empleados (id_empleado) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_ventas_clientes FOREIGN KEY (id_cliente)
    REFERENCES clientes (id_cliente) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_ventas_fecha (fecha),
  INDEX idx_ventas_empleado (id_empleado),
  INDEX idx_ventas_cliente (id_cliente),
  INDEX idx_ventas_usuario (id_usuario)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS detalle_ventas (
  id_detalle_venta INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_venta         INT UNSIGNED  NOT NULL,
  id_producto      INT UNSIGNED  NOT NULL,
  cantidad         INT           NOT NULL,
  precio_unitario  DECIMAL(10,2) NOT NULL,
  costo_unitario   DECIMAL(10,2) NULL,
  subtotal         DECIMAL(12,2) NOT NULL,
  CONSTRAINT pk_detalle_ventas PRIMARY KEY (id_detalle_venta),
  CONSTRAINT uq_detalle_ventas_producto UNIQUE (id_venta, id_producto),
  CONSTRAINT ck_detalle_ventas_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_detalle_ventas_ventas FOREIGN KEY (id_venta)
    REFERENCES ventas (id_venta) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_detalle_ventas_productos FOREIGN KEY (id_producto)
    REFERENCES productos (id_producto) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_detalle_ventas_producto (id_producto)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS devoluciones (
  id_devolucion INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_venta      INT UNSIGNED  NOT NULL,
  id_usuario    INT UNSIGNED  NOT NULL,
  id_empleado   INT UNSIGNED  NOT NULL,
  motivo        VARCHAR(255)  NOT NULL,
  total         DECIMAL(12,2) NOT NULL,
  fecha         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_devoluciones PRIMARY KEY (id_devolucion),
  CONSTRAINT ck_devoluciones_total CHECK (total >= 0),
  CONSTRAINT fk_devoluciones_ventas FOREIGN KEY (id_venta)
    REFERENCES ventas (id_venta) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_devoluciones_usuarios FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_devoluciones_empleados FOREIGN KEY (id_empleado)
    REFERENCES empleados (id_empleado) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_devoluciones_venta (id_venta),
  INDEX idx_devoluciones_fecha (fecha)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS detalle_devoluciones (
  id_detalle_devolucion INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_devolucion         INT UNSIGNED  NOT NULL,
  id_detalle_venta      INT UNSIGNED  NOT NULL,
  cantidad              INT           NOT NULL,
  monto                 DECIMAL(12,2) NOT NULL,
  CONSTRAINT pk_detalle_devoluciones PRIMARY KEY (id_detalle_devolucion),
  CONSTRAINT uq_detalle_devoluciones_linea UNIQUE (id_devolucion, id_detalle_venta),
  CONSTRAINT ck_detalle_devoluciones_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_detalle_devoluciones_devoluciones FOREIGN KEY (id_devolucion)
    REFERENCES devoluciones (id_devolucion) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_detalle_devoluciones_detalle_ventas FOREIGN KEY (id_detalle_venta)
    REFERENCES detalle_ventas (id_detalle_venta) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_detalle_devoluciones_detalle_venta (id_detalle_venta)
) ENGINE = InnoDB;

-- Cada movimiento automático queda vinculado a su venta o devolución.
ALTER TABLE movimientos ADD COLUMN id_venta INT UNSIGNED NULL;
ALTER TABLE movimientos ADD COLUMN id_devolucion INT UNSIGNED NULL;
ALTER TABLE movimientos ADD INDEX idx_movimientos_venta (id_venta);
ALTER TABLE movimientos ADD INDEX idx_movimientos_devolucion (id_devolucion);
ALTER TABLE movimientos ADD CONSTRAINT fk_movimientos_ventas FOREIGN KEY (id_venta)
  REFERENCES ventas (id_venta) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE movimientos ADD CONSTRAINT fk_movimientos_devoluciones FOREIGN KEY (id_devolucion)
  REFERENCES devoluciones (id_devolucion) ON DELETE RESTRICT ON UPDATE RESTRICT;
