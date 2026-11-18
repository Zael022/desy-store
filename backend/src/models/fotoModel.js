// Modelo de fotos de productos: consultas SQL de la tabla producto_fotos.
//
// Orden de las fotos (columna "orden": 1, 2, 3...):
//   - Primero las fotos normales; la primera de ellas es la foto PRINCIPAL.
//   - Al final, SIEMPRE, las fotos con medidas (es_de_medidas = 1): nunca son la principal
//     y no se usan en las tarjetas del catálogo.
// Cada vez que algo cambia (subir, borrar, principal, marcar medidas) se vuelve a numerar
// con esa regla, así la base nunca queda con una foto de medidas de primera.
import pool from '../config/db.js';

const COLUMNAS = 'id_foto, id_producto, archivo, orden, es_de_medidas';

// Fotos de un producto en orden (normales primero, medidas al final).
export async function listarPorProducto(idProducto, conexion = pool) {
  const [filas] = await conexion.execute(
    `SELECT ${COLUMNAS} FROM producto_fotos WHERE id_producto = ? ORDER BY es_de_medidas, orden, id_foto`,
    [idProducto]
  );
  return filas.map((f) => ({ ...f, es_de_medidas: f.es_de_medidas === 1 }));
}

export async function obtener(idFoto, idProducto, conexion = pool) {
  const fotos = await listarPorProducto(idProducto, conexion);
  return fotos.find((f) => f.id_foto === idFoto) || null;
}

// Vuelve a numerar 1, 2, 3...: normales primero y medidas al final.
// Si se pasa idPrimera (una foto normal), esa queda de primera (principal).
async function ordenar(conexion, idProducto, idPrimera = null) {
  const fotos = await listarPorProducto(idProducto, conexion);
  const normales = fotos.filter((f) => !f.es_de_medidas);
  const medidas = fotos.filter((f) => f.es_de_medidas);
  const elegida = normales.findIndex((f) => f.id_foto === idPrimera);
  if (elegida > 0) normales.unshift(...normales.splice(elegida, 1));
  for (const [indice, foto] of [...normales, ...medidas].entries()) {
    if (foto.orden !== indice + 1) {
      await conexion.execute('UPDATE producto_fotos SET orden = ? WHERE id_foto = ?', [indice + 1, foto.id_foto]);
    }
  }
}

// La nueva foto queda al final de su grupo (normales o medidas).
export async function crear(conexion, idProducto, archivo, esDeMedidas = false) {
  const [resultado] = await conexion.execute(
    `INSERT INTO producto_fotos (id_producto, archivo, orden, es_de_medidas)
     SELECT ?, ?, COALESCE(MAX(orden), 0) + 1, ? FROM producto_fotos WHERE id_producto = ?`,
    [idProducto, archivo, esDeMedidas ? 1 : 0, idProducto]
  );
  await ordenar(conexion, idProducto);
  return resultado.insertId;
}

export async function eliminar(conexion, idFoto, idProducto) {
  await conexion.execute('DELETE FROM producto_fotos WHERE id_foto = ? AND id_producto = ?', [idFoto, idProducto]);
  await ordenar(conexion, idProducto);
}

// Pone una foto normal de primera (principal). Las de medidas no pueden (lo revisa el controlador).
export async function hacerPrincipal(conexion, idFoto, idProducto) {
  await ordenar(conexion, idProducto, idFoto);
}

// Marca o desmarca una foto como "de medidas" y vuelve a ordenar.
export async function marcarMedidas(conexion, idFoto, idProducto, esDeMedidas) {
  await conexion.execute('UPDATE producto_fotos SET es_de_medidas = ? WHERE id_foto = ? AND id_producto = ?', [esDeMedidas ? 1 : 0, idFoto, idProducto]);
  await ordenar(conexion, idProducto);
}

// Borra TODAS las fotos de un producto (se usa antes de borrar el producto).
// Devuelve los nombres de archivo para borrarlos del disco después.
export async function eliminarDeProducto(conexion, idProducto) {
  const fotos = await listarPorProducto(idProducto, conexion);
  await conexion.execute('DELETE FROM producto_fotos WHERE id_producto = ?', [idProducto]);
  return fotos.map((f) => f.archivo);
}
