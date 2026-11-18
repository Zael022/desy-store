// Modelo de productos: consultas SQL de la tabla productos.
// Ojo: aquí NO hay ninguna función que cambie el stock.
// El stock solo cambia en movimientoModel.js (entradas y salidas).
import pool, { enTransaccion } from '../config/db.js';
import { eliminarDeProducto } from './fotoModel.js';
import { sqlApartado } from './apartados.js';

// Trae el producto junto con los NOMBRES de su categoría (y categoría padre),
// proveedor y material, más su foto principal y cuántas fotos tiene
// (así el frontend puede mostrarlos sin hacer más peticiones).
const SELECT_PRODUCTOS = `
  SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, p.precio, p.costo_unitario, p.stock,
         p.id_categoria, c.nombre AS nombre_categoria,
         c.id_categoria_padre, cp.nombre AS nombre_categoria_padre,
         p.id_proveedor, pr.nombre AS nombre_proveedor,
         p.id_material,  m.nombre AS nombre_material,
         (SELECT COUNT(*) FROM movimientos mo WHERE mo.id_producto = p.id_producto) AS total_movimientos,
         (SELECT f.archivo FROM producto_fotos f WHERE f.id_producto = p.id_producto AND f.es_de_medidas = 0 ORDER BY f.orden, f.id_foto LIMIT 1) AS foto_principal,
         (SELECT COUNT(*) FROM producto_fotos f WHERE f.id_producto = p.id_producto) AS total_fotos,
         ${sqlApartado('p')} AS apartado
    FROM productos p
    JOIN categorias c   ON c.id_categoria = p.id_categoria
    LEFT JOIN categorias cp ON cp.id_categoria = c.id_categoria_padre
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
// costo_unitario es opcional (null = todavía no se conoce el costo).
export async function crear({ codigo, nombre, descripcion, precio, costo_unitario = null, id_categoria, id_proveedor, id_material }) {
  const [resultado] = await pool.execute(
    `INSERT INTO productos (codigo, nombre, descripcion, precio, costo_unitario, stock, id_categoria, id_proveedor, id_material)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [codigo, nombre, descripcion, precio, costo_unitario, id_categoria, id_proveedor, id_material]
  );
  return resultado.insertId;
}

// Actualiza todo MENOS el stock.
// Si "datos" no trae costo_unitario (porque quien edita no es la dueña), el costo no se toca.
export async function actualizar(id, datos) {
  const { codigo, nombre, descripcion, precio, id_categoria, id_proveedor, id_material } = datos;
  const cambiaCosto = Object.hasOwn(datos, 'costo_unitario');
  await pool.execute(
    `UPDATE productos
        SET codigo = ?, nombre = ?, descripcion = ?, precio = ?,
            id_categoria = ?, id_proveedor = ?, id_material = ?${cambiaCosto ? ', costo_unitario = ?' : ''}
      WHERE id_producto = ?`,
    [codigo, nombre, descripcion, precio, id_categoria, id_proveedor, id_material, ...(cambiaCosto ? [datos.costo_unitario] : []), id]
  );
}

// Borra el producto y sus fotos en una sola transacción.
// Devuelve los nombres de archivo de las fotos para borrarlas del disco.
export async function eliminar(id) {
  return enTransaccion(async (conexion) => {
    const archivos = await eliminarDeProducto(conexion, id);
    await conexion.execute('DELETE FROM productos WHERE id_producto = ?', [id]);
    return archivos;
  });
}

export async function contarMovimientos(id) {
  const [filas] = await pool.execute('SELECT COUNT(*) AS total FROM movimientos WHERE id_producto = ?', [id]);
  return filas[0].total;
}
