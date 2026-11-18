// Envío de correos (Nodemailer + SMTP) y SMS (API de Twilio).
//
// Las credenciales salen solo del .env del backend. Nunca se envían al
// navegador ni se escriben en las respuestas de la API.
//
// "Modo consola" (solo si NODE_ENV=development y MFA_MODO_CONSOLA=true):
// el mensaje se muestra en la consola del backend en lugar de enviarse.
// La persona igual tiene que escribir el código: nunca se salta el segundo factor.
import nodemailer from 'nodemailer';
import { configuracion } from '../config/env.js';
import { ErrorHttp } from '../middleware/errores.js';

// Error de envío: la API responde 503 con este mensaje (nunca dice "enviado").
export class ErrorEnvio extends ErrorHttp {
  constructor(message) {
    super(503, message);
  }
}

// En las pruebas automáticas (NODE_ENV=test) se puede "capturar" lo que se
// enviaría, para leer el código sin mandar correos de verdad.
let capturaDePrueba = null;
export function usarCapturaDePrueba(funcion) {
  if (!configuracion.esPrueba) throw new Error('La captura de mensajes solo existe en NODE_ENV=test.');
  capturaDePrueba = funcion; // null = volver a enviar de verdad (pruebas de SMTP y Twilio)
}

export const PATRON_TELEFONO_INTERNACIONAL = /^\+[1-9]\d{7,14}$/;

export function correoConfigurado() {
  const c = configuracion.correo;
  return Boolean(c.host && c.usuario && c.contrasena && c.remitente);
}

// ¿Se puede "entregar" un correo ahora? (servicio real configurado, modo consola o captura de prueba)
export function correoDisponible() {
  return Boolean(capturaDePrueba) || configuracion.seguridad.mfaModoConsola || correoConfigurado();
}

export function smsConfigurado() {
  const s = configuracion.sms;
  return Boolean(s.cuentaSid && s.tokenAutenticacion && s.numeroOrigen);
}

// El transporte SMTP se crea una sola vez (y se vuelve a crear si cambian los datos del .env).
let transporte = null;
let claveTransporte = '';
function obtenerTransporte() {
  const c = configuracion.correo;
  const clave = [c.host, c.puerto, c.seguro, c.usuario, c.contrasena].join('|');
  if (!transporte || clave !== claveTransporte) {
    transporte = nodemailer.createTransport({
      host: c.host,
      port: c.puerto,
      secure: c.seguro, // true para el puerto 465; false para 587 (usa STARTTLS)
      auth: { user: c.usuario, pass: c.contrasena },
      connectionTimeout: 15000
    });
    claveTransporte = clave;
  }
  return transporte;
}

// Traduce los errores más comunes de SMTP a mensajes claros.
function explicarErrorSmtp(error) {
  if (error.code === 'EAUTH') {
    return 'El servidor de correo rechazó el usuario o la contraseña. Con Gmail hay que usar una "contraseña de aplicación" (vea el README).';
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNREFUSED'].includes(error.code)) {
    return 'No se pudo conectar al servidor de correo. Revise SMTP_HOST, SMTP_PORT y SMTP_SECURE en el .env.';
  }
  if (error.responseCode >= 500) return `El servidor de correo rechazó el mensaje (${error.responseCode}). Revise el correo de destino y SMTP_FROM.`;
  return 'No se pudo enviar el correo. Revise la configuración SMTP del .env.';
}

// Revisa (sin enviar nada) si el servidor SMTP acepta el usuario y la contraseña del .env.
// Se usa al arrancar el backend para avisar enseguida si Gmail rechaza la clave.
export async function probarCorreo() {
  if (!correoConfigurado()) return { ok: false, mensaje: 'no configurado' };
  try {
    await obtenerTransporte().verify();
    return { ok: true, mensaje: `el servidor aceptó el usuario ${configuracion.correo.usuario}` };
  } catch (error) {
    return { ok: false, mensaje: `${explicarErrorSmtp(error)} (usuario: ${configuracion.correo.usuario}; detalle: ${error.code || ''} ${error.responseCode || ''})` };
  }
}

export async function enviarCorreo({ para, asunto, texto, html }) {
  if (capturaDePrueba) return capturaDePrueba({ canal: 'correo', para, asunto, texto });
  if (configuracion.seguridad.mfaModoConsola) {
    console.log(`\n[MODO CONSOLA] Correo para ${para}\n  Asunto: ${asunto}\n  ${texto.replace(/\n/g, '\n  ')}\n`);
    return { modoConsola: true };
  }
  if (!correoConfigurado()) {
    throw new ErrorEnvio('El envío de correos no está configurado. Falta SMTP_HOST, SMTP_USER, SMTP_PASS o SMTP_FROM en el .env del backend.');
  }
  try {
    await obtenerTransporte().sendMail({ from: configuracion.correo.remitente, to: para, subject: asunto, text: texto, html });
    return { modoConsola: false };
  } catch (error) {
    console.error('[Correo] Error al enviar:', error.code || '', error.message);
    throw new ErrorEnvio(explicarErrorSmtp(error));
  }
}

// SMS con la API REST de Twilio (sin SDK): un POST con usuario y contraseña de la cuenta.
export async function enviarSms({ para, texto }) {
  if (capturaDePrueba) return capturaDePrueba({ canal: 'sms', para, texto });
  if (configuracion.seguridad.mfaModoConsola) {
    console.log(`\n[MODO CONSOLA] SMS para ${para}\n  ${texto}\n`);
    return { modoConsola: true };
  }
  if (!smsConfigurado()) {
    throw new ErrorEnvio('El envío de SMS no está configurado. Falta TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o TWILIO_FROM_NUMBER en el .env del backend.');
  }
  const { cuentaSid, tokenAutenticacion, numeroOrigen, urlApi } = configuracion.sms;
  const credenciales = Buffer.from(`${cuentaSid}:${tokenAutenticacion}`).toString('base64');
  let respuesta;
  try {
    respuesta = await fetch(`${urlApi}/2010-04-01/Accounts/${encodeURIComponent(cuentaSid)}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${credenciales}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: para, From: numeroOrigen, Body: texto })
    });
  } catch (error) {
    console.error('[SMS] No se pudo conectar con Twilio:', error.message);
    throw new ErrorEnvio('No se pudo conectar con Twilio para enviar el SMS. Revise la conexión a internet.');
  }
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}));
    console.error('[SMS] Twilio respondió', respuesta.status, cuerpo.code, cuerpo.message);
    if (cuerpo.code === 21608 || cuerpo.code === 21614 || cuerpo.code === 21211) {
      throw new ErrorEnvio('Twilio no aceptó el número. Con una cuenta de prueba, el número de destino debe estar verificado en Twilio (vea el README).');
    }
    if (respuesta.status === 401) throw new ErrorEnvio('Twilio rechazó las credenciales. Revise TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN.');
    // Las cuentas de prueba recientes de Twilio también pueden rechazar mensajes con texto propio
    // o hacia otro país: el código de Twilio permite buscar el motivo exacto en su documentación.
    throw new ErrorEnvio(
      `Twilio no pudo enviar el SMS${cuerpo.code ? ` (código de Twilio ${cuerpo.code})` : ''}. Revise TWILIO_FROM_NUMBER, el número de destino (formato +50688887777) y las restricciones de su cuenta de prueba (vea el README). Mientras tanto, use el correo.`
    );
  }
  return { modoConsola: false };
}

// Textos de los mensajes con código.
const TEXTOS_CODIGO = {
  mfa: 'Su código para iniciar sesión en Desy es',
  verificar_correo: 'Su código para verificar el correo en Desy es',
  verificar_telefono: 'Su código para verificar el teléfono en Desy es',
  cambio_correo: 'Su código para confirmar su nuevo correo en Desy es'
};

// Envía un código de 6 dígitos por el canal pedido. No guarda nada.
export async function enviarCodigo({ canal, destino, codigo, proposito, minutos }) {
  const texto = `${TEXTOS_CODIGO[proposito]} ${codigo}. Vence en ${minutos} minutos. Si no lo pidió, ignore este mensaje y no lo comparta con nadie.`;
  if (canal === 'sms') return enviarSms({ para: destino, texto });
  return enviarCorreo({
    para: destino,
    asunto: `Desy · Código ${codigo}`,
    texto,
    html: `<p>${TEXTOS_CODIGO[proposito]}:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${codigo}</p><p>Vence en ${minutos} minutos. Si no lo pidió, ignore este mensaje y no lo comparta con nadie.</p>`
  });
}

// Envía un enlace de un solo uso (recuperar contraseña o aceptar invitación).
export async function enviarEnlace({ para, proposito, enlace, minutos, nombreRol }) {
  const esInvitacion = proposito === 'invitacion';
  const asunto = esInvitacion ? 'Desy · Invitación para crear su cuenta' : 'Desy · Restablecer su contraseña';
  const intro = esInvitacion
    ? `La tienda Desy le creó una cuenta con el rol "${nombreRol}". Para definir su contraseña y activar la cuenta, abra este enlace:`
    : 'Recibimos una solicitud para restablecer su contraseña. Para elegir una nueva, abra este enlace:';
  const vence = minutos >= 60 ? `${Math.round(minutos / 60)} horas` : `${minutos} minutos`;
  const texto = `${intro}\n\n${enlace}\n\nEl enlace sirve una sola vez y vence en ${vence}. Si usted no lo pidió, ignore este correo.`;
  return enviarCorreo({
    para,
    asunto,
    texto,
    html: `<p>${intro}</p><p><a href="${enlace}">${enlace}</a></p><p>El enlace sirve una sola vez y vence en ${vence}. Si usted no lo pidió, ignore este correo.</p>`
  });
}
