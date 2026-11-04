// Modelo de proveedores: consultas SQL de la tabla proveedores.
import pool from '../config/db.js';

const COLUMNAS = `pr.id_proveedor, pr.nombre, pr.contacto, pr.telefono, pr.correo, pr.direccion,
                  COUNT(p.id_producto) AS total_productos`;

export async function listar() {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS}
       FROM proveedores pr
       LEFT JOIN productos p ON p.id_proveedor = pr.id_proveedor
      GROUP BY pr.id_proveedor
      ORDER BY pr.nombre`
  );
  return filas;
}

export async function obtenerPorId(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS}
       FROM proveedores pr
       LEFT JOIN productos p ON p.id_proveedor = pr.id_proveedor
      WHERE pr.id_proveedor = ?
      GROUP BY pr.id_proveedor`,
    [id]
  );
  return filas[0] || null;
}

export async function crear({ nombre, contacto, telefono, correo, direccion }) {
  const [resultado] = await pool.execute(
    'INSERT INTO proveedores (nombre, contacto, telefono, correo, direccion) VALUES (?, ?, ?, ?, ?)',
    [nombre, contacto, telefono, correo, direccion]
  );
  return resultado.insertId;
}

export async function actualizar(id, { nombre, contacto, telefono, correo, direccion }) {
  await pool.execute(
    'UPDATE proveedores SET nombre = ?, contacto = ?, telefono = ?, correo = ?, direccion = ? WHERE id_proveedor = ?',
    [nombre, contacto, telefono, correo, direccion, id]
  );
}

export async function eliminar(id) {
  await pool.execute('DELETE FROM proveedores WHERE id_proveedor = ?', [id]);
}

export async function contarProductos(id) {
  const [filas] = await pool.execute('SELECT COUNT(*) AS total FROM productos WHERE id_proveedor = ?', [id]);
  return filas[0].total;
}
