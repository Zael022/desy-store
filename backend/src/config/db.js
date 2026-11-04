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
  // Devuelve DATE (fecha) como texto "AAAA-MM-DD" y no como objeto Date,
  // así no hay problemas de zona horaria.
  dateStrings: true
});

export default pool;
