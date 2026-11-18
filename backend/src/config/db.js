// Conexión a MySQL usando un "pool" de conexiones.
// Un pool es como una fila de cajas abiertas en un banco: en lugar de abrir
// y cerrar una conexión nueva en cada petición, el pool mantiene varias
// conexiones listas y se las presta a quien las necesite.
import mysql from 'mysql2/promise';
import { configuracion } from './env.js';

const pool = mysql.createPool({
  host: configuracion.db.host,
  port: configuracion.db.puerto,
  user: configuracion.db.usuario,
  password: configuracion.db.contrasena,
  database: configuracion.db.nombre,
  waitForConnections: true,
  connectionLimit: 10,
  // Devuelve DECIMAL (precio) como número y no como texto.
  decimalNumbers: true,
  // Devuelve DATE y DATETIME como texto ("AAAA-MM-DD" o "AAAA-MM-DD HH:MM:SS")
  // y no como objeto Date, así no hay problemas de zona horaria.
  dateStrings: true
});

// Ejecuta "trabajo" dentro de una TRANSACCIÓN.
// Analogía: una transferencia bancaria. El dinero no puede salir de una cuenta
// sin llegar a la otra: o se guardan todos los cambios (COMMIT) o ninguno (ROLLBACK).
// "trabajo" recibe la conexión y debe usarla para todas sus consultas.
export async function enTransaccion(trabajo) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release(); // devuelve la conexión al pool
  }
}

export default pool;
