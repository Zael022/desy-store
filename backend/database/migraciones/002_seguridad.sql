-- =====================================================================
-- Migración 002: seguridad (MFA, sesiones, recuperación y auditoría)
-- En ninguna tabla se guarda un código, token o contraseña en texto plano:
-- solo su "hash" (una huella que no se puede revertir).
-- =====================================================================

-- Desafío MFA: se crea cuando la contraseña es correcta, dura 5 minutos
-- y solo sirve para pedir y verificar el código del segundo factor.
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

-- Códigos de 6 dígitos: MFA, verificar correo, verificar teléfono y cambio de correo.
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

-- Sesiones reales (después del segundo factor).
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

-- Enlaces de un solo uso: recuperar la contraseña (15 minutos) o aceptar una invitación (48 horas).
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

-- Auditoría: quién hizo qué, cuándo y desde qué IP (nunca contraseñas ni códigos).
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
