// Modelo de materiales: consultas SQL de la tabla materiales.
import pool from '../config/db.js';

// MySQL guarda es_hipoalergenico como 0/1; la API lo devuelve como true/false.
function convertirFila(fila) {
  return { ...fila, es_hipoalergenico: fila.es_hipoalergenico === 1 };
}

const COLUMNAS = `m.id_material, m.nombre, m.es_hipoalergenico, m.descripcion,
                  COUNT(p.id_producto) AS total_productos`;

export async function listar() {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS}
       FROM materiales m
       LEFT JOIN productos p ON p.id_material = m.id_material
      GROUP BY m.id_material
      ORDER BY m.nombre`
  );
  return filas.map(convertirFila);
}

export async function obtenerPorId(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS}
       FROM materiales m
       LEFT JOIN productos p ON p.id_material = m.id_material
      WHERE m.id_material = ?
      GROUP BY m.id_material`,
    [id]
  );
  return filas[0] ? convertirFila(filas[0]) : null;
}

export async function crear({ nombre, es_hipoalergenico, descripcion }) {
  const [resultado] = await pool.execute(
    'INSERT INTO materiales (nombre, es_hipoalergenico, descripcion) VALUES (?, ?, ?)',
    [nombre, es_hipoalergenico ? 1 : 0, descripcion]
  );
  return resultado.insertId;
}

export async function actualizar(id, { nombre, es_hipoalergenico, descripcion }) {
  await pool.execute(
    'UPDATE materiales SET nombre = ?, es_hipoalergenico = ?, descripcion = ? WHERE id_material = ?',
    [nombre, es_hipoalergenico ? 1 : 0, descripcion, id]
  );
}

export async function eliminar(id) {
  await pool.execute('DELETE FROM materiales WHERE id_material = ?', [id]);
}

export async function contarProductos(id) {
  const [filas] = await pool.execute('SELECT COUNT(*) AS total FROM productos WHERE id_material = ?', [id]);
  return filas[0].total;
}
