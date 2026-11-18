-- =====================================================================
-- Migración 001: usuarios y clientes
-- Agrega las cuentas para iniciar sesión. No borra ni cambia datos existentes.
--
-- Roles (se escriben sin ñ para evitar problemas de codificación):
--   cliente | proveedor | ventas | administrador | duena
--
-- Vínculos (sin duplicar datos):
--   * proveedor  -> usuarios.id_proveedor apunta a su fila en proveedores.
--   * ventas, administrador y duena -> usuarios.id_empleado apunta a su fila en empleados.
--   * cliente    -> sus datos están en la tabla clientes (1 a 1 con su usuario).
-- =====================================================================

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
