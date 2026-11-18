// Se importa PRIMERO en cada archivo de prueba: prepara las variables de
// entorno antes de que se cargue el backend.
//   * NODE_ENV=test
//   * Base de datos SEPARADA (por defecto inventario_bisuteria_prueba): las
//     pruebas la borran y la vuelven a crear, nunca tocan su base real.
//   * Los mensajes (correo/SMS) se "capturan" en memoria en vez de enviarse.
import os from 'node:os';
import path from 'node:path';

// Primero se leen los datos de MySQL del .env (si existe)...
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // sin .env: se usan las variables del sistema
}
// ...y luego se fuerzan los valores de prueba.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_PRUEBAS || 'inventario_bisuteria_prueba';
process.env.MFA_MODO_CONSOLA = 'false';
// Las fotos de las pruebas van a una carpeta temporal (nunca a backend/uploads).
process.env.CARPETA_FOTOS = path.join(os.tmpdir(), 'desy-fotos-pruebas');
process.env.CODIGOS_MAXIMO_POR_HORA = process.env.CODIGOS_MAXIMO_POR_HORA_PRUEBAS || '1000';
if (!process.env.CODIGOS_SECRETO || process.env.CODIGOS_SECRETO.length < 32) {
  // Secreto solo para las pruebas (la base de pruebas se borra en cada ejecución).
  process.env.CODIGOS_SECRETO = 'secreto-solo-para-las-pruebas-automaticas-0123456789';
}
// Sin servicios reales: si algún mensaje no se captura, la prueba falla en vez de enviarlo.
for (const variable of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']) {
  process.env[variable] = '';
}
