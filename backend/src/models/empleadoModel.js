// Modelo de empleados: consultas SQL de la tabla empleados.
import pool from '../config/db.js';

const COLUMNAS = `e.id_empleado, e.nombre, e.puesto, e.telefono, e.correo,
                  COUNT(m.id_movimiento) AS total_movimientos`;

export async function listar() {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS}
       FROM empleados e
       LEFT JOIN movimientos m ON m.id_empleado = e.id_empleado
      GROUP BY e.id_empleado
      ORDER BY e.nombre`
  );
  return filas;
}

export async function obtenerPorId(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS}
       FROM empleados e
       LEFT JOIN movimientos m ON m.id_empleado = e.id_empleado
      WHERE e.id_empleado = ?
      GROUP BY e.id_empleado`,
    [id]
  );
  return filas[0] || null;
}

export async function crear({ nombre, puesto, telefono, correo }) {
  const [resultado] = await pool.execute(
    'INSERT INTO empleados (nombre, puesto, telefono, correo) VALUES (?, ?, ?, ?)',
    [nombre, puesto, telefono, correo]
  );
  return resultado.insertId;
}

export async function actualizar(id, { nombre, puesto, telefono, correo }) {
  await pool.execute(
    'UPDATE empleados SET nombre = ?, puesto = ?, telefono = ?, correo = ? WHERE id_empleado = ?',
    [nombre, puesto, telefono, correo, id]
  );
}

export async function eliminar(id) {
  await pool.execute('DELETE FROM empleados WHERE id_empleado = ?', [id]);
}

export async function contarMovimientos(id) {
  const [filas] = await pool.execute('SELECT COUNT(*) AS total FROM movimientos WHERE id_empleado = ?', [id]);
  return filas[0].total;
}

// ¿Tiene una cuenta de usuario o ventas registradas? (entonces no se puede borrar)
export async function contarVinculos(id) {
  const [filas] = await pool.execute(
    `SELECT (SELECT COUNT(*) FROM usuarios WHERE id_empleado = ?) AS cuentas,
            (SELECT COUNT(*) FROM ventas WHERE id_empleado = ?) + (SELECT COUNT(*) FROM devoluciones WHERE id_empleado = ?) AS ventas`,
    [id, id, id]
  );
  return filas[0];
}
