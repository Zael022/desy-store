// Punto de arranque del backend: enciende el servidor de Express.
// Se ejecuta desde la carpeta backend con: npm run dev  (o npm start)
import app from './app.js';
import pool from './config/db.js';
import { configuracion, revisarConfiguracion } from './config/env.js';
import { correoConfigurado, probarCorreo, smsConfigurado } from './servicios/notificaciones.js';
import { algoritmoEnUso } from './servicios/contrasenas.js';
import { vencerYAvisar } from './controllers/pedidoController.js';

// Sin los secretos indispensables el backend no arranca (sería inseguro).
const problemas = revisarConfiguracion();
if (problemas.length > 0) {
  console.error('No se puede arrancar la API. Revise el archivo .env:');
  for (const problema of problemas) console.error(`  - ${problema}`);
  process.exit(1);
}

app.listen(configuracion.puerto, async () => {
  console.log(`API escuchando en http://localhost:${configuracion.puerto}/api (entorno: ${configuracion.entorno})`);
  console.log(`Origen permitido (CORS): ${configuracion.corsOrigen}`);
  console.log(`Contraseñas: ${algoritmoEnUso}`);

  if (configuracion.seguridad.mfaModoConsola) {
    console.log('MODO CONSOLA ACTIVO: los códigos y enlaces se muestran en esta consola en lugar de enviarse. Úselo solo para desarrollo.');
  } else {
    console.log(`Correo (SMTP): ${correoConfigurado() ? 'configurado' : 'NO configurado (no se podrán enviar códigos por correo)'}`);
    console.log(`SMS (Twilio): ${smsConfigurado() ? 'configurado' : 'NO configurado (solo se podrá usar el correo)'}`);
  }
  if (!configuracion.seguridad.mfaModoConsola && correoConfigurado()) {
    const prueba = await probarCorreo();
    if (prueba.ok) console.log(`Correo (SMTP): prueba de acceso correcta, ${prueba.mensaje}.`);
    else console.error(`Correo (SMTP): prueba de acceso FALLÓ. ${prueba.mensaje}`);
  }
  if (configuracion.seguridad.mfaModoConsolaPedidoEnProduccion) {
    console.warn('AVISO: MFA_MODO_CONSOLA=true se ignora porque NODE_ENV=production.');
  }

  // Prueba la conexión a MySQL al arrancar para avisar enseguida si algo está mal.
  try {
    await pool.query('SELECT 1');
    console.log(`Conectado a MySQL (base de datos "${configuracion.db.nombre}").`);
    const [pendientes] = await pool.query("SHOW TABLES LIKE 'usuarios'");
    if (pendientes.length === 0) console.warn('Falta aplicar las migraciones: ejecute "npm run migrar".');
  } catch (error) {
    console.error(`No se pudo conectar a MySQL: ${error.code || error.message}.`);
    console.error('Revise que MySQL esté encendido y los datos DB_* del archivo .env.');
  }

  // Pedidos: cada 5 minutos se vencen los que pasaron su plazo (se liberan sus
  // unidades y se avisa al cliente). También se revisa cada vez que alguien abre los pedidos.
  const revisarPedidos = () =>
    vencerYAvisar()
      .then((total) => total > 0 && console.log(`Pedidos vencidos: ${total} (sus unidades se liberaron).`))
      .catch((error) => error.code !== 'ER_NO_SUCH_TABLE' && console.error('[Pedidos] No se pudieron revisar los vencimientos:', error.message));
  revisarPedidos();
  setInterval(revisarPedidos, 5 * 60 * 1000).unref();
});
