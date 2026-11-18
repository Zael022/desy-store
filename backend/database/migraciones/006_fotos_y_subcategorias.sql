-- =====================================================================
-- Migración 006: subcategorías y fotos de los productos
--
-- 1. categorias.id_categoria_padre: una categoría puede estar dentro de otra
--    (por ejemplo Crochet > Peluches). Solo hay dos niveles: el backend no deja
--    que una subcategoría tenga a su vez subcategorías.
-- 2. producto_fotos: las fotos de cada producto. En la base solo se guarda el
--    NOMBRE del archivo; la imagen vive en la carpeta backend/uploads/productos.
--    La foto con el "orden" más bajo es la foto principal.
-- Como en el resto del esquema, las llaves foráneas usan RESTRICT (sin cascada):
-- el backend borra las fotos antes de borrar el producto.
-- =====================================================================

ALTER TABLE categorias ADD COLUMN id_categoria_padre INT UNSIGNED NULL;

ALTER TABLE categorias ADD INDEX idx_categorias_padre (id_categoria_padre);

ALTER TABLE categorias ADD CONSTRAINT fk_categorias_padre FOREIGN KEY (id_categoria_padre)
  REFERENCES categorias (id_categoria) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE IF NOT EXISTS producto_fotos (
  id_foto     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_producto INT UNSIGNED NOT NULL,
  archivo     VARCHAR(100) NOT NULL,
  orden       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  creada_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_producto_fotos PRIMARY KEY (id_foto),
  CONSTRAINT uq_producto_fotos_archivo UNIQUE (archivo),
  CONSTRAINT fk_producto_fotos_productos FOREIGN KEY (id_producto)
    REFERENCES productos (id_producto) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_producto_fotos_producto (id_producto, orden)
) ENGINE = InnoDB;
