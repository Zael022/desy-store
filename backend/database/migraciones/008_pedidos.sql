-- =====================================================================
-- Migración 008: pedidos de clientes con productos apartados
--
-- Cómo funciona (en palabras simples):
--   * El cliente arma un pedido en la tienda en línea. Las unidades quedan
--     APARTADAS: nadie más las puede comprar, pero el stock físico no cambia
--     (el stock solo cambia con movimientos, igual que siempre).
--   * Disponible para vender = stock - unidades apartadas en pedidos activos.
--   * Pedido activo = estado 'pendiente' o 'confirmado' y vence_en en el futuro.
--   * La tienda confirma (queda "listo para recoger") o rechaza. Al entregarlo
--     se registra una venta normal (con su salida de inventario) y se guarda id_venta.
--   * Si nadie lo confirma o el cliente no llega, vence solo y las unidades se liberan.
-- Estados: pendiente, confirmado, entregado, rechazado, cancelado, vencido.
-- =====================================================================

CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  clave_idempotencia CHAR(36)      NOT NULL,
  id_cliente         INT UNSIGNED  NOT NULL,
  estado             ENUM('pendiente', 'confirmado', 'entregado', 'rechazado', 'cancelado', 'vencido') NOT NULL DEFAULT 'pendiente',
  total              DECIMAL(12,2) NOT NULL,
  nota_cliente       VARCHAR(255)  NULL,
  motivo             VARCHAR(255)  NULL,
  creado_en          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vence_en           DATETIME      NOT NULL,
  confirmado_en      DATETIME      NULL,
  cerrado_en         DATETIME      NULL,
  id_usuario_atendio INT UNSIGNED  NULL,
  id_venta           INT UNSIGNED  NULL,
  CONSTRAINT pk_pedidos PRIMARY KEY (id_pedido),
  CONSTRAINT uq_pedidos_clave UNIQUE (clave_idempotencia),
  CONSTRAINT uq_pedidos_venta UNIQUE (id_venta),
  CONSTRAINT ck_pedidos_total CHECK (total >= 0),
  CONSTRAINT fk_pedidos_clientes FOREIGN KEY (id_cliente)
    REFERENCES clientes (id_cliente) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_pedidos_usuarios FOREIGN KEY (id_usuario_atendio)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_pedidos_ventas FOREIGN KEY (id_venta)
    REFERENCES ventas (id_venta) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_pedidos_estado (estado, vence_en),
  INDEX idx_pedidos_cliente (id_cliente, creado_en)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS detalle_pedidos (
  id_detalle_pedido INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_pedido         INT UNSIGNED  NOT NULL,
  id_producto       INT UNSIGNED  NOT NULL,
  cantidad          INT           NOT NULL,
  precio_unitario   DECIMAL(10,2) NOT NULL,
  subtotal          DECIMAL(12,2) NOT NULL,
  CONSTRAINT pk_detalle_pedidos PRIMARY KEY (id_detalle_pedido),
  CONSTRAINT uq_detalle_pedidos_producto UNIQUE (id_pedido, id_producto),
  CONSTRAINT ck_detalle_pedidos_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_detalle_pedidos_pedidos FOREIGN KEY (id_pedido)
    REFERENCES pedidos (id_pedido) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_detalle_pedidos_productos FOREIGN KEY (id_producto)
    REFERENCES productos (id_producto) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_detalle_pedidos_producto (id_producto)
) ENGINE = InnoDB;

-- Plazos (la dueña los cambia en Configuración).
INSERT IGNORE INTO configuracion (clave, valor, descripcion) VALUES
  ('horas_pedido_pendiente', '48', 'Horas que la tienda tiene para confirmar un pedido. Si no lo confirma, vence y las unidades apartadas se liberan.'),
  ('dias_pedido_confirmado', '7', 'Días que el cliente tiene para recoger un pedido confirmado. Después vence y las unidades se liberan.');
