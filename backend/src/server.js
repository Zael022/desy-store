// Punto de arranque del backend: enciende el servidor de Express.
// Se ejecuta desde la carpeta backend con: npm run dev  (o npm start)
import app from './app.js';
import pool from './config/db.js';
import { configuracion } from './config/env.js';

app.listen(configuracion.puerto, async () => {
  console.log(`API escuchando en http://localhost:${configuracion.puerto}/api`);
  console.log(`Origen permitido (CORS): ${configuracion.corsOrigen}`);

  // Prueba la conexión a MySQL al arrancar para avisar enseguida si algo está mal.
  try {
    await pool.query('SELECT 1');
    console.log(`Conectado a MySQL (base de datos "${configuracion.db.nombre}").`);
  } catch (error) {
    console.error(`No se pudo conectar a MySQL: ${error.code || error.message}.`);
    console.error('Revise que MySQL esté encendido y los datos DB_* del archivo .env.');
  }
});
