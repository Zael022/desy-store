// Modelo de productos: consultas SQL de la tabla productos.
// Ojo: aquí NO hay ninguna función que cambie el stock.
// El stock solo cambia en movimientoModel.js (entradas y salidas).
import pool from '../config/db.js';

// Trae el producto junto con los NOMBRES de su categoría, proveedor y material
// (así el frontend puede mostrarlos sin hacer más peticiones).
const SELECT_PRODUCTOS = `
  SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, p.precio, p.stock,
         p.id_categoria, c.nombre AS nombre_categoria,
         p.id_proveedor, pr.nombre AS nombre_proveedor,
         p.id_material,  m.nombre AS nombre_material,
         (SELECT COUNT(*) FROM movimientos mo WHERE mo.id_producto = p.id_producto) AS total_movimientos
    FROM productos p
    JOIN categorias c   ON c.id_categoria = p.id_categoria
    JOIN proveedores pr ON pr.id_proveedor = p.id_proveedor
    JOIN materiales m   ON m.id_material = p.id_material`;

export async function listar() {
  const [filas] = await pool.query(`${SELECT_PRODUCTOS} ORDER BY p.nombre`);
  return filas;
}

export async function obtenerPorId(id) {
  const [filas] = await pool.execute(`${SELECT_PRODUCTOS} WHERE p.id_producto = ?`, [id]);
  return filas[0] || null;
}

// Un producto nuevo siempre empieza con stock 0.
export async function crear({ codigo, nombre, descripcion, precio, id_categoria, id_proveedor, id_material }) {
  const [resultado] = await pool.execute(
    `INSERT INTO productos (codigo, nombre, descripcion, precio, stock, id_categoria, id_proveedor, id_material)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    [codigo, nombre, descripcion, precio, id_categoria, id_proveedor, id_material]
  );
  return resultado.insertId;
}

// Actualiza todo MENOS el stock.
export async function actualizar(id, { codigo, nombre, descripcion, precio, id_categoria, id_proveedor, id_material }) {
  await pool.execute(
    `UPDATE productos
        SET codigo = ?, nombre = ?, descripcion = ?, precio = ?,
            id_categoria = ?, id_proveedor = ?, id_material = ?
      WHERE id_producto = ?`,
    [codigo, nombre, descripcion, precio, id_categoria, id_proveedor, id_material, id]
  );
}

export async function eliminar(id) {
  await pool.execute('DELETE FROM productos WHERE id_producto = ?', [id]);
}

export async function contarMovimientos(id) {
  const [filas] = await pool.execute('SELECT COUNT(*) AS total FROM movimientos WHERE id_producto = ?', [id]);
  return filas[0].total;
}
