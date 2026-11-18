-- =====================================================================
-- Desy · Sistema de inventario, ventas y roles (MySQL 8)
-- Script de creación de la base de datos COMPLETA.
--
-- ¿Cuándo usarlo?
--   * Base NUEVA (desde cero): ejecute este script y luego "npm run migrar"
--     (el migrador solo anotará que todo ya está aplicado).
--   * Base que YA EXISTE (versión anterior del proyecto): NO hace falta este
--     script; ejecute "npm run migrar" desde la carpeta backend.
--
-- Cómo ejecutarlo (desde la carpeta backend):
--   mysql -u root -p -e "source database/script.sql"
-- o abriéndolo en MySQL Workbench y presionando Run / el rayo.
--
-- Se puede ejecutar varias veces: usa "IF NOT EXISTS", así que NO borra
-- datos existentes. Para empezar de cero, ejecute antes:
--   DROP DATABASE inventario_bisuteria;
--
-- Reglas generales:
--   * Todas las llaves foráneas usan ON DELETE RESTRICT y ON UPDATE RESTRICT
--     (no hay eliminaciones en cascada).
--   * El stock mínimo (0) se protege también aquí con un CHECK.
--     El stock máximo (67) vive SOLO en backend/src/config/constantes.js.
--   * Las tablas de la 7 en adelante son las mismas que crean las
--     migraciones 001 a 008 (database/migraciones).
-- =====================================================================

-- Los textos con tildes y eñes se envían en UTF-8.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS inventario_bisuteria
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE inventario_bisuteria;

-- ---------------------------------------------------------------------
-- 1. categorias: tipo de producto (aretes, collares, crochet...).
--    Sirve para ordenar el catálogo y ver el stock por tipo de producto.
--    id_categoria_padre (migración 006): si tiene valor, es una SUBcategoría
--    (por ejemplo Crochet > Peluches). Solo hay dos niveles.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id_categoria       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre             VARCHAR(60)  NOT NULL,
  descripcion        VARCHAR(255) NULL,
  id_categoria_padre INT UNSIGNED NULL,
  CONSTRAINT pk_categorias PRIMARY KEY (id_categoria),
  CONSTRAINT uq_categorias_nombre UNIQUE (nombre),
  CONSTRAINT fk_categorias_padre FOREIGN KEY (id_categoria_padre)
    REFERENCES categorias (id_categoria) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_categorias_padre (id_categoria_padre)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2. proveedores: a quién se le compra la mercadería.
--    Sirve para saber a quién volver a pedir un producto.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
  id_proveedor INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(100) NOT NULL,
  contacto     VARCHAR(100) NULL,
  telefono     VARCHAR(20)  NOT NULL,
  correo       VARCHAR(100) NULL,
  direccion    VARCHAR(255) NULL,
  CONSTRAINT pk_proveedores PRIMARY KEY (id_proveedor),
  CONSTRAINT uq_proveedores_nombre UNIQUE (nombre),
  CONSTRAINT uq_proveedores_correo UNIQUE (correo)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 3. materiales: de qué está hecho el producto (plata 925, acero...).
--    En bisutería el material define el precio, el cuidado y si una
--    persona alérgica lo puede usar (es_hipoalergenico).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materiales (
  id_material       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre            VARCHAR(60)  NOT NULL,
  es_hipoalergenico TINYINT(1)   NOT NULL DEFAULT 0,
  descripcion       VARCHAR(255) NULL,
  CONSTRAINT pk_materiales PRIMARY KEY (id_material),
  CONSTRAINT uq_materiales_nombre UNIQUE (nombre),
  CONSTRAINT ck_materiales_hipoalergenico CHECK (es_hipoalergenico IN (0, 1))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 4. empleados: personas de la tienda que registran entradas y salidas.
--    No es un sistema de usuarios (no hay login): solo deja constancia
--    de quién hizo cada movimiento.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
  id_empleado INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(100) NOT NULL,
  puesto      VARCHAR(60)  NOT NULL,
  telefono    VARCHAR(20)  NULL,
  correo      VARCHAR(100) NOT NULL,
  CONSTRAINT pk_empleados PRIMARY KEY (id_empleado),
  CONSTRAINT uq_empleados_correo UNIQUE (correo)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 5. productos: lo que la tienda vende.
--    "stock" es la ÚNICA fuente de verdad de las existencias y solo
--    cambia mediante movimientos (tabla movimientos).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id_producto  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo       VARCHAR(20)   NOT NULL,
  nombre       VARCHAR(100)  NOT NULL,
  descripcion  VARCHAR(255)  NULL,
  precio       DECIMAL(10,2) NOT NULL,
  costo_unitario DECIMAL(10,2) NULL,
  stock        INT           NOT NULL DEFAULT 0,
  id_categoria INT UNSIGNED  NOT NULL,
  id_proveedor INT UNSIGNED  NOT NULL,
  id_material  INT UNSIGNED  NOT NULL,
  CONSTRAINT pk_productos PRIMARY KEY (id_producto),
  CONSTRAINT uq_productos_codigo UNIQUE (codigo),
  CONSTRAINT ck_productos_precio CHECK (precio >= 0),
  CONSTRAINT ck_productos_costo CHECK (costo_unitario IS NULL OR costo_unitario >= 0),
  CONSTRAINT ck_productos_stock_minimo CHECK (stock >= 0),
  CONSTRAINT fk_productos_categorias FOREIGN KEY (id_categoria)
    REFERENCES categorias (id_categoria) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_productos_proveedores FOREIGN KEY (id_proveedor)
    REFERENCES proveedores (id_proveedor) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_productos_materiales FOREIGN KEY (id_material)
    REFERENCES materiales (id_material) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_productos_categoria (id_categoria),
  INDEX idx_productos_proveedor (id_proveedor),
  INDEX idx_productos_material (id_material),
  INDEX idx_productos_nombre (nombre)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 6. producto_fotos (migración 006): fotos de cada producto.
--    Solo se guarda el nombre del archivo; la imagen está en
--    backend/uploads/productos. La de menor "orden" es la foto principal;
--    las fotos con medidas (es_de_medidas = 1) siempre van al final.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producto_fotos (
  id_foto     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_producto INT UNSIGNED NOT NULL,
  archivo     VARCHAR(100) NOT NULL,
  orden       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  es_de_medidas TINYINT(1)    NOT NULL DEFAULT 0, -- migración 007: 1 = foto con medidas (nunca es la principal)
  creada_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_producto_fotos PRIMARY KEY (id_foto),
  CONSTRAINT uq_producto_fotos_archivo UNIQUE (archivo),
  CONSTRAINT fk_producto_fotos_productos FOREIGN KEY (id_producto)
    REFERENCES productos (id_producto) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_producto_fotos_producto (id_producto, orden)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 7. usuarios: cuentas para iniciar sesión (rol, verificaciones y bloqueo).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  correo              VARCHAR(100) NOT NULL,
  hash_contrasena     VARCHAR(255) NULL,
  rol                 ENUM('cliente', 'proveedor', 'ventas', 'administrador', 'duena') NOT NULL,
  activo              TINYINT(1)   NOT NULL DEFAULT 1,
  correo_verificado   TINYINT(1)   NOT NULL DEFAULT 0,
  telefono            VARCHAR(20)  NULL,
  telefono_verificado TINYINT(1)   NOT NULL DEFAULT 0,
  intentos_fallidos   INT          NOT NULL DEFAULT 0,
  bloqueado_hasta     DATETIME     NULL,
  id_empleado         INT UNSIGNED NULL,
  id_proveedor        INT UNSIGNED NULL,
  creado_en           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso       DATETIME     NULL,
  CONSTRAINT pk_usuarios PRIMARY KEY (id_usuario),
  CONSTRAINT uq_usuarios_correo UNIQUE (correo),
  CONSTRAINT uq_usuarios_empleado UNIQUE (id_empleado),
  CONSTRAINT uq_usuarios_proveedor UNIQUE (id_proveedor),
  CONSTRAINT ck_usuarios_activo CHECK (activo IN (0, 1)),
  CONSTRAINT ck_usuarios_intentos CHECK (intentos_fallidos >= 0),
  -- Cada rol tiene exactamente el vínculo que le corresponde.
  CONSTRAINT ck_usuarios_vinculo CHECK (
    (rol = 'cliente' AND id_empleado IS NULL AND id_proveedor IS NULL)
    OR (rol = 'proveedor' AND id_proveedor IS NOT NULL AND id_empleado IS NULL)
    OR (rol IN ('ventas', 'administrador', 'duena') AND id_empleado IS NOT NULL AND id_proveedor IS NULL)
  ),
  CONSTRAINT fk_usuarios_empleados FOREIGN KEY (id_empleado)
    REFERENCES empleados (id_empleado) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_usuarios_proveedores FOREIGN KEY (id_proveedor)
    REFERENCES proveedores (id_proveedor) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_usuarios_rol (rol)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 8. clientes: datos propios del cliente, 1 a 1 con su usuario.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id_cliente INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario INT UNSIGNED NOT NULL,
  nombre     VARCHAR(100) NOT NULL,
  direccion  VARCHAR(255) NULL,
  creado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_clientes PRIMARY KEY (id_cliente),
  CONSTRAINT uq_clientes_usuario UNIQUE (id_usuario),
  CONSTRAINT fk_clientes_usuarios FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_clientes_nombre (nombre)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 9. desafios_mfa: paso intermedio entre la contraseña y el código MFA.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS desafios_mfa (
  id_desafio INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario INT UNSIGNED NOT NULL,
  hash_token CHAR(64)     NOT NULL,
  expira_en  DATETIME     NOT NULL,
  usado      TINYINT(1)   NOT NULL DEFAULT 0,
  ip         VARCHAR(45)  NULL,
  creado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_desafios_mfa PRIMARY KEY (id_desafio),
  CONSTRAINT uq_desafios_mfa_token UNIQUE (hash_token),
  CONSTRAINT fk_desafios_mfa_usuarios FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_desafios_mfa_usuario (id_usuario)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 10. codigos_verificacion: códigos de 6 dígitos (solo su hash).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS codigos_verificacion (
  id_codigo   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario  INT UNSIGNED NOT NULL,
  id_desafio  INT UNSIGNED NULL,
  proposito   ENUM('mfa', 'verificar_correo', 'verificar_telefono', 'cambio_correo') NOT NULL,
  canal       ENUM('correo', 'sms') NOT NULL,
  destino     VARCHAR(100) NOT NULL,
  hash_codigo CHAR(64)     NOT NULL,
  expira_en   DATETIME     NOT NULL,
  intentos    INT          NOT NULL DEFAULT 0,
  usado       TINYINT(1)   NOT NULL DEFAULT 0,
  anulado     TINYINT(1)   NOT NULL DEFAULT 0,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_codigos_verificacion PRIMARY KEY (id_codigo),
  CONSTRAINT ck_codigos_intentos CHECK (intentos >= 0),
  CONSTRAINT fk_codigos_usuarios FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_codigos_desafios FOREIGN KEY (id_desafio)
    REFERENCES desafios_mfa (id_desafio) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_codigos_usuario_proposito (id_usuario, proposito, creado_en),
  INDEX idx_codigos_desafio (id_desafio)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 11. sesiones: sesiones reales (solo el hash del token).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesiones (
  id_sesion        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario       INT UNSIGNED NOT NULL,
  hash_token       CHAR(64)     NOT NULL,
  creada_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_actividad DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_absoluta  DATETIME     NOT NULL,
  revocada         TINYINT(1)   NOT NULL DEFAULT 0,
  ip               VARCHAR(45)  NULL,
  agente           VARCHAR(255) NULL,
  CONSTRAINT pk_sesiones PRIMARY KEY (id_sesion),
  CONSTRAINT uq_sesiones_token UNIQUE (hash_token),
  CONSTRAINT fk_sesiones_usuarios FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_sesiones_usuario (id_usuario, revocada)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 12. recuperacion_contrasena: enlaces de un solo uso (recuperar o invitación).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recuperacion_contrasena (
  id_recuperacion    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario         INT UNSIGNED NOT NULL,
  proposito          ENUM('recuperar', 'invitacion') NOT NULL,
  hash_token         CHAR(64)     NOT NULL,
  expira_en          DATETIME     NOT NULL,
  usado              TINYINT(1)   NOT NULL DEFAULT 0,
  id_usuario_creador INT UNSIGNED NULL,
  creado_en          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_recuperacion_contrasena PRIMARY KEY (id_recuperacion),
  CONSTRAINT uq_recuperacion_token UNIQUE (hash_token),
  CONSTRAINT fk_recuperacion_usuarios FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_recuperacion_creador FOREIGN KEY (id_usuario_creador)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_recuperacion_usuario (id_usuario, proposito)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 13. auditoria: quién hizo qué, cuándo y desde qué IP.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario   INT UNSIGNED    NULL,
  accion       VARCHAR(60)     NOT NULL,
  detalle      VARCHAR(500)    NULL,
  ip           VARCHAR(45)     NULL,
  creado_en    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_auditoria PRIMARY KEY (id_auditoria),
  CONSTRAINT fk_auditoria_usuarios FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_auditoria_accion (accion),
  INDEX idx_auditoria_fecha (creado_en),
  INDEX idx_auditoria_usuario (id_usuario)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 14. ventas: encabezado de cada venta (no se editan ni se borran).
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 15. detalle_ventas: productos de cada venta con precio y costo de ese momento.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 16. devoluciones: correcciones de una venta (devuelven stock).
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 16b. detalle_devoluciones: qué líneas de la venta se devolvieron.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 17. solicitudes_abastecimiento: pedidos de la tienda a un proveedor.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 17b. detalle_solicitudes_abastecimiento: productos y cantidades pedidas.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- pedidos y detalle_pedidos (migración 008): pedidos de clientes.
--   Las unidades de un pedido activo (pendiente o confirmado y sin vencer)
--   quedan apartadas: disponible = stock - apartado. Al entregarlo se
--   registra una venta normal (id_venta).
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 18. movimientos: cada entrada (compra, devolución de cliente...) o
--    salida (venta, daño, regalo...) de mercadería.
--    Una entrada suma al stock del producto; una salida resta.
--    Los movimientos automáticos quedan vinculados a su venta,
--    devolución o solicitud de abastecimiento (id_venta, id_devolucion, id_solicitud).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos (
  id_movimiento INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_producto   INT UNSIGNED NOT NULL,
  id_empleado   INT UNSIGNED NOT NULL,
  tipo          ENUM('entrada', 'salida') NOT NULL,
  cantidad      INT          NOT NULL,
  fecha         DATE         NOT NULL,
  motivo        VARCHAR(255) NULL,
  id_venta      INT UNSIGNED NULL,
  id_devolucion INT UNSIGNED NULL,
  id_solicitud  INT UNSIGNED NULL,
  CONSTRAINT pk_movimientos PRIMARY KEY (id_movimiento),
  CONSTRAINT ck_movimientos_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_movimientos_productos FOREIGN KEY (id_producto)
    REFERENCES productos (id_producto) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_movimientos_empleados FOREIGN KEY (id_empleado)
    REFERENCES empleados (id_empleado) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_movimientos_producto (id_producto),
  INDEX idx_movimientos_empleado (id_empleado),
  INDEX idx_movimientos_fecha (fecha),
  INDEX idx_movimientos_venta (id_venta),
  INDEX idx_movimientos_devolucion (id_devolucion),
  INDEX idx_movimientos_solicitud (id_solicitud),
  CONSTRAINT fk_movimientos_ventas FOREIGN KEY (id_venta)
    REFERENCES ventas (id_venta) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_movimientos_devoluciones FOREIGN KEY (id_devolucion)
    REFERENCES devoluciones (id_devolucion) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_movimientos_solicitudes FOREIGN KEY (id_solicitud)
    REFERENCES solicitudes_abastecimiento (id_solicitud) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 19. configuracion: ajustes generales que cambia la dueña.
-- ---------------------------------------------------------------------
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
  ('mensaje_catalogo', 'Bisutería y accesorios hechos con cariño. Consulte la disponibilidad en tienda.', 'Mensaje que ven los clientes en el catálogo.'),
  ('horas_pedido_pendiente', '48', 'Horas que la tienda tiene para confirmar un pedido. Si no lo confirma, vence y las unidades apartadas se liberan.'),
  ('dias_pedido_confirmado', '7', 'Días que el cliente tiene para recoger un pedido confirmado. Después vence y las unidades se liberan.');

-- ---------------------------------------------------------------------
-- 20. migraciones_aplicadas: la usa "npm run migrar" para anotar qué se aplicó.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
  nombre      VARCHAR(100) NOT NULL,
  aplicada_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_migraciones_aplicadas PRIMARY KEY (nombre)
) ENGINE = InnoDB;
