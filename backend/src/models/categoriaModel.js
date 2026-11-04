// Modelo de categorías: aquí están TODAS las consultas SQL de la tabla categorias.
// Los "?" son consultas preparadas: MySQL recibe los valores por separado,
// así nadie puede "inyectar" SQL escribiendo cosas raras en un formulario.
import pool from '../config/db.js';

export async function listar() {
  const [filas] = await pool.query(
    `SELECT c.id_categoria, c.nombre, c.descripcion,
            COUNT(p.id_producto) AS total_productos
       FROM categorias c
       LEFT JOIN productos p ON p.id_categoria = c.id_categoria
      GROUP BY c.id_categoria
      ORDER BY c.nombre`
  );
  return filas;
}

export async function obtenerPorId(id) {
  const [filas] = await pool.execute(
    `SELECT c.id_categoria, c.nombre, c.descripcion,
            COUNT(p.id_producto) AS total_productos
       FROM categorias c
       LEFT JOIN productos p ON p.id_categoria = c.id_categoria
      WHERE c.id_categoria = ?
      GROUP BY c.id_categoria`,
    [id]
  );
  return filas[0] || null;
}

export async function crear({ nombre, descripcion }) {
  const [resultado] = await pool.execute(
    'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
    [nombre, descripcion]
  );
  return resultado.insertId;
}

export async function actualizar(id, { nombre, descripcion }) {
  await pool.execute(
    'UPDATE categorias SET nombre = ?, descripcion = ? WHERE id_categoria = ?',
    [nombre, descripcion, id]
  );
}

export async function eliminar(id) {
  await pool.execute('DELETE FROM categorias WHERE id_categoria = ?', [id]);
}

// Cuántos productos usan esta categoría (para no borrarla si tiene).
export async function contarProductos(id) {
  const [filas] = await pool.execute('SELECT COUNT(*) AS total FROM productos WHERE id_categoria = ?', [id]);
  return filas[0].total;
}
