// Carga las variables del archivo .env en un solo lugar.
// Todo el backend lee la configuración desde aquí.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// quiet: true evita mensajes extra de dotenv en la consola.
dotenv.config({ quiet: true });

const entorno = process.env.NODE_ENV || 'development';

// Convierte "true"/"false" del .env en booleano.
const comoBooleano = (valor) => String(valor).trim().toLowerCase() === 'true';
const comoNumero = (valor, porDefecto) => (Number.isFinite(Number(valor)) && Number(valor) > 0 ? Number(valor) : porDefecto);

export const configuracion = {
  entorno,
  esProduccion: entorno === 'production',
  esPrueba: entorno === 'test',
  puerto: Number(process.env.PORT) || 3000,
  corsOrigen: process.env.CORS_ORIGIN || 'http://localhost:5173',
  // Dirección pública del frontend: se usa para armar los enlaces de los correos.
  frontendUrl: (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/$/, ''),
  db: {
    host: process.env.DB_HOST || 'localhost',
    puerto: Number(process.env.DB_PORT) || 3306,
    usuario: process.env.DB_USER || 'root',
    contrasena: process.env.DB_PASSWORD || '',
    nombre: process.env.DB_NAME || 'inventario_bisuteria'
  },
  seguridad: {
    // Secreto para el HMAC de los códigos de 6 dígitos. Obligatorio (mínimo 32 caracteres).
    codigosSecreto: process.env.CODIGOS_SECRETO || '',
    sesionInactividadMinutos: comoNumero(process.env.SESION_INACTIVIDAD_MINUTOS, 30),
    sesionAbsolutaHoras: comoNumero(process.env.SESION_ABSOLUTA_HORAS, 8),
    // "Modo consola" de MFA: el código se muestra en la consola en vez de enviarse.
    // Solo funciona con NODE_ENV=development (o test). En producción nunca se activa.
    // Solo si NODE_ENV=development está escrito EXPLÍCITAMENTE (o en las pruebas automáticas).
    mfaModoConsola: comoBooleano(process.env.MFA_MODO_CONSOLA) && (process.env.NODE_ENV === 'development' || entorno === 'test'),
    mfaModoConsolaPedidoEnProduccion: comoBooleano(process.env.MFA_MODO_CONSOLA) && entorno === 'production'
  },
  correo: {
    host: process.env.SMTP_HOST || '',
    puerto: Number(process.env.SMTP_PORT) || 587,
    seguro: comoBooleano(process.env.SMTP_SECURE),
    usuario: process.env.SMTP_USER || '',
    contrasena: process.env.SMTP_PASS || '',
    remitente: process.env.SMTP_FROM || process.env.SMTP_USER || ''
  },
  // Carpeta donde se guardan las fotos de los productos (por defecto backend/uploads/productos).
  // No se sube a GitHub: las fotos iniciales se copian desde database/fotos con "npm run seed".
  fotos: {
    carpeta: path.resolve(process.env.CARPETA_FOTOS || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads', 'productos'))
  },
  sms: {
    cuentaSid: process.env.TWILIO_ACCOUNT_SID || '',
    tokenAutenticacion: process.env.TWILIO_AUTH_TOKEN || '',
    numeroOrigen: process.env.TWILIO_FROM_NUMBER || '',
    // Solo para pruebas automáticas: permite apuntar a un servidor de imitación.
    urlApi: (process.env.TWILIO_API_URL || 'https://api.twilio.com').replace(/\/$/, '')
  }
};

// Revisa que existan los secretos indispensables antes de arrancar.
// Devuelve una lista de problemas (vacía si todo está bien).
export function revisarConfiguracion() {
  const problemas = [];
  if (configuracion.seguridad.codigosSecreto.length < 32) {
    problemas.push('CODIGOS_SECRETO falta o tiene menos de 32 caracteres. Genere uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return problemas;
}
