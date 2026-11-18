-- =====================================================================
-- Migración 007: fotos "de medidas"
--
-- Las fotos que muestran las medidas del producto (flechas y centímetros)
-- nunca pueden ser la foto principal: siempre van al final de la galería
-- y no se usan en las tarjetas del catálogo.
-- es_de_medidas: 1 = foto con medidas, 0 = foto normal.
-- =====================================================================

ALTER TABLE producto_fotos ADD COLUMN es_de_medidas TINYINT(1) NOT NULL DEFAULT 0 AFTER orden;

-- Las fotos iniciales de Desy que tienen medidas (si ya se cargaron).
UPDATE producto_fotos SET es_de_medidas = 1
 WHERE archivo IN ('cro-dec-001-1.webp', 'cro-lla-001-2.webp', 'cro-lla-002-2.webp', 'cro-lla-003-3.webp',
                   'cro-pel-001-2.webp', 'cro-pel-002-2.webp', 'cro-pel-002-3.webp', 'cro-pel-003-1.webp',
                   'cro-pel-004-3.webp');
