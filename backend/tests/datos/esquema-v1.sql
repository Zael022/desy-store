-- =====================================================================
-- Sistema de inventario para una tienda de bisutería y accesorios
-- Script de creación de la base de datos (MySQL 8)
--
-- Cómo ejecutarlo (desde la carpeta backend):
--   mysql -u root -p < database/script.sql
-- o abriéndolo en MySQL Workbench y presionando el rayo (Execute).
--
-- Se puede ejecutar varias veces: usa "IF NOT EXISTS", así que NO borra
-- datos existentes. Para empezar de cero, ejecute antes:
--   DROP DATABASE inventario_bisuteria;
--
-- Reglas generales:
--   * Todas las llaves foráneas usan ON DELETE RESTRICT y ON UPDATE RESTRICT
--     (no hay eliminaciones en cascada). Si un registro tiene otros que
--     dependen de él, MySQL no deja borrarlo y la API responde 409.
--   * El stock mínimo (0) se protege también aquí con un CHECK.
--     El stock máximo (67) vive SOLO en backend/src/config/constantes.js,
--     para poder cambiarlo en un único lugar.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS inventario_bisuteria
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE inventario_bisuteria;

-- ---------------------------------------------------------------------
-- 1. categorias: tipo de producto (aretes, collares, pulseras...).
--    Sirve para ordenar el catálogo y ver el stock por tipo de producto.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id_categoria INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(60)  NOT NULL,
  descripcion  VARCHAR(255) NULL,
  CONSTRAINT pk_categorias PRIMARY KEY (id_categoria),
  CONSTRAINT uq_categorias_nombre UNIQUE (nombre)
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
  stock        INT           NOT NULL DEFAULT 0,
  id_categoria INT UNSIGNED  NOT NULL,
  id_proveedor INT UNSIGNED  NOT NULL,
  id_material  INT UNSIGNED  NOT NULL,
  CONSTRAINT pk_productos PRIMARY KEY (id_producto),
  CONSTRAINT uq_productos_codigo UNIQUE (codigo),
  CONSTRAINT ck_productos_precio CHECK (precio >= 0),
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
-- 6. movimientos: cada entrada (compra, devolución de cliente...) o
--    salida (venta, daño, regalo...) de mercadería.
--    Una entrada suma al stock del producto; una salida resta.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos (
  id_movimiento INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_producto   INT UNSIGNED NOT NULL,
  id_empleado   INT UNSIGNED NOT NULL,
  tipo          ENUM('entrada', 'salida') NOT NULL,
  cantidad      INT          NOT NULL,
  fecha         DATE         NOT NULL,
  motivo        VARCHAR(255) NULL,
  CONSTRAINT pk_movimientos PRIMARY KEY (id_movimiento),
  CONSTRAINT ck_movimientos_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_movimientos_productos FOREIGN KEY (id_producto)
    REFERENCES productos (id_producto) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_movimientos_empleados FOREIGN KEY (id_empleado)
    REFERENCES empleados (id_empleado) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_movimientos_producto (id_producto),
  INDEX idx_movimientos_empleado (id_empleado),
  INDEX idx_movimientos_fecha (fecha)
) ENGINE = InnoDB;
