// Modelo de categorías: aquí están TODAS las consultas SQL de la tabla categorias.
// Los "?" son consultas preparadas: MySQL recibe los valores por separado,
// así nadie puede "inyectar" SQL escribiendo cosas raras en un formulario.
//
// Subcategorías: si id_categoria_padre tiene valor, la categoría está dentro de
// otra (por ejemplo Crochet > Peluches). Solo hay dos niveles.
import pool from '../config/db.js';

const SELECT_CATEGORIAS = `
  SELECT c.id_categoria, c.nombre, c.descripcion,
         c.id_categoria_padre, padre.nombre AS nombre_padre,
         (SELECT COUNT(*) FROM productos p WHERE p.id_categoria = c.id_categoria) AS total_productos,
         (SELECT COUNT(*) FROM categorias h WHERE h.id_categoria_padre = c.id_categoria) AS total_subcategorias
    FROM categorias c
    LEFT JOIN categorias padre ON padre.id_categoria = c.id_categoria_padre`;

export async function listar() {
  // Primero cada categoría principal y debajo sus subcategorías (orden alfabético).
  const [filas] = await pool.query(`${SELECT_CATEGORIAS} ORDER BY COALESCE(padre.nombre, c.nombre), c.id_categoria_padre IS NOT NULL, c.nombre`);
  return filas;
}

export async function obtenerPorId(id) {
  const [filas] = await pool.execute(`${SELECT_CATEGORIAS} WHERE c.id_categoria = ?`, [id]);
  return filas[0] || null;
}

export async function crear({ nombre, descripcion, id_categoria_padre = null }) {
  const [resultado] = await pool.execute(
    'INSERT INTO categorias (nombre, descripcion, id_categoria_padre) VALUES (?, ?, ?)',
    [nombre, descripcion, id_categoria_padre]
  );
  return resultado.insertId;
}

export async function actualizar(id, { nombre, descripcion, id_categoria_padre = null }) {
  await pool.execute(
    'UPDATE categorias SET nombre = ?, descripcion = ?, id_categoria_padre = ? WHERE id_categoria = ?',
    [nombre, descripcion, id_categoria_padre, id]
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

// Cuántas subcategorías tiene (para no borrarla ni volverla subcategoría si tiene).
export async function contarSubcategorias(id) {
  const [filas] = await pool.execute('SELECT COUNT(*) AS total FROM categorias WHERE id_categoria_padre = ?', [id]);
  return filas[0].total;
}
