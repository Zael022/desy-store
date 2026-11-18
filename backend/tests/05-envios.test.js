// Pruebas del envío REAL de correos (Nodemailer por SMTP) y SMS (API de Twilio).
// Para no depender de Gmail ni de Twilio, se levantan aquí mismo:
//   * un servidor SMTP de verdad (paquete smtp-server) que pide usuario y contraseña;
//   * un servidor HTTP que imita la API de Twilio (TWILIO_API_URL).
// El código del backend es el mismo que se usa con Gmail y Twilio reales.
import './entorno.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { SMTPServer } from 'smtp-server';
import { prepararBase, cerrar, pool, Navegador, crearCuenta } from './ayudante.js';
import { configuracion } from '../src/config/env.js';
import { usarCapturaDePrueba } from '../src/servicios/notificaciones.js';

const USUARIO_SMTP = 'tienda@prueba.test';
const CLAVE_SMTP = 'clave-de-aplicacion-prueba';
const recibidos = [];
const smsRecibidos = [];
let servidorSmtp;
let servidorTwilio;
let respuestaTwilio = { status: 201, cuerpo: { sid: 'SM123', status: 'queued' } };

before(async () => {
  await prepararBase();
  usarCapturaDePrueba(null); // a partir de aquí los mensajes se ENVÍAN de verdad

  servidorSmtp = new SMTPServer({
    disabledCommands: ['STARTTLS'],
    authOptional: false,
    onAuth(auth, _sesion, responder) {
      if (auth.username === USUARIO_SMTP && auth.password === CLAVE_SMTP) return responder(null, { user: auth.username });
      return responder(new Error('Usuario o contraseña inválidos'));
    },
    onData(flujo, sesion, responder) {
      let datos = '';
      flujo.on('data', (parte) => { datos += parte.toString(); });
      flujo.on('end', () => {
        recibidos.push({ para: sesion.envelope.rcptTo.map((r) => r.address), datos });
        responder();
      });
    }
  });
  await new Promise((listo) => servidorSmtp.listen(0, '127.0.0.1', listo));

  servidorTwilio = http.createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (parte) => { cuerpo += parte; });
    req.on('end', () => {
      smsRecibidos.push({ url: req.url, autorizacion: req.headers.authorization, datos: Object.fromEntries(new URLSearchParams(cuerpo)) });
      res.writeHead(respuestaTwilio.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(respuestaTwilio.cuerpo));
    });
  });
  await new Promise((listo) => servidorTwilio.listen(0, '127.0.0.1', listo));

  Object.assign(configuracion.correo, {
    host: '127.0.0.1',
    puerto: servidorSmtp.server.address().port,
    seguro: false,
    usuario: USUARIO_SMTP,
    contrasena: CLAVE_SMTP,
    remitente: 'Desy <tienda@prueba.test>'
  });
  Object.assign(configuracion.sms, {
    cuentaSid: 'AC0000000000000000000000000000prueba',
    tokenAutenticacion: 'token-de-prueba',
    numeroOrigen: '+15005550006',
    urlApi: `http://127.0.0.1:${servidorTwilio.address().port}`
  });
});

after(async () => {
  await new Promise((listo) => servidorSmtp.close(listo));
  await new Promise((listo) => servidorTwilio.close(listo));
  await cerrar();
});

// El cuerpo puede venir en "quoted-printable": se buscan 6 dígitos seguidos.
const codigoDe = (datos) => /\b(\d{6})\b/.exec(datos.replace(/=\r?\n/g, ''))[1];

// Login completo leyendo el código MFA del correo que recibió el servidor SMTP.
async function sesionReal(rol) {
  const cuenta = await crearCuenta(rol);
  const navegador = new Navegador();
  await navegador.post('/api/auth/login', { correo: cuenta.correo, contrasena: cuenta.contrasena });
  assert.equal((await navegador.post('/api/auth/mfa/enviar', { canal: 'correo' })).status, 200);
  const mensaje = recibidos.filter((m) => m.para.includes(cuenta.correo)).at(-1);
  assert.equal((await navegador.post('/api/auth/mfa/verificar', { codigo: codigoDe(mensaje.datos) })).status, 200);
  return { navegador, cuenta };
}

test('SMTP real: el registro envía el código por correo y con él se verifica la cuenta', async () => {
  const navegador = new Navegador();
  const correo = `smtp.${Date.now()}@prueba.test`;
  const r = await navegador.post('/api/auth/registro', { nombre: 'Correo Real', correo, contrasena: 'ClaveSmtp-2026' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const mensaje = recibidos.find((m) => m.para.includes(correo));
  assert.ok(mensaje, 'el servidor SMTP recibió el correo');
  assert.match(mensaje.datos, /From: Desy <tienda@prueba.test>/);
  const verificar = await navegador.post('/api/auth/verificar-correo', { correo, codigo: codigoDe(mensaje.datos) });
  assert.equal(verificar.status, 200);

  // Y el login completo con MFA por correo real.
  await navegador.post('/api/auth/login', { correo, contrasena: 'ClaveSmtp-2026' });
  assert.equal((await navegador.post('/api/auth/mfa/enviar', { canal: 'correo' })).status, 200);
  const mfa = recibidos.filter((m) => m.para.includes(correo)).at(-1);
  assert.equal((await navegador.post('/api/auth/mfa/verificar', { codigo: codigoDe(mfa.datos) })).status, 200);
});

test('SMTP con contraseña incorrecta: 503 con explicación, no dice "enviado" y no crea la cuenta', async () => {
  configuracion.correo.contrasena = 'contrasena-normal-de-gmail';
  try {
    const correo = `fallo.${Date.now()}@prueba.test`;
    const r = await new Navegador().post('/api/auth/registro', { nombre: 'Falla', correo, contrasena: 'ClaveSmtp-2026' });
    assert.equal(r.status, 503);
    assert.match(r.body.message, /contraseña de aplicación/);
    assert.doesNotMatch(r.body.message, /enviamos/i);
    const [filas] = await pool.execute('SELECT id_usuario FROM usuarios WHERE correo = ?', [correo]);
    assert.equal(filas.length, 0);
  } finally {
    configuracion.correo.contrasena = CLAVE_SMTP;
  }
});

test('Sin SMTP configurado (y sin modo consola): error claro 503', async () => {
  const respaldo = configuracion.correo.host;
  configuracion.correo.host = '';
  try {
    const r = await new Navegador().post('/api/auth/recuperar', { correo: 'cualquiera@prueba.test' });
    assert.equal(r.status, 503);
    assert.match(r.body.message, /no está configurado/);
  } finally {
    configuracion.correo.host = respaldo;
  }
});

test('Twilio: la verificación del teléfono envía un SMS real a la API (formato +506) y el código funciona', async () => {
  const { navegador } = await sesionReal('cliente');
  const r = await navegador.post('/api/perfil/telefono', { telefono: '+506 8877-6655' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const sms = smsRecibidos.at(-1);
  assert.equal(sms.url, `/2010-04-01/Accounts/${configuracion.sms.cuentaSid}/Messages.json`);
  assert.equal(sms.autorizacion, `Basic ${Buffer.from(`${configuracion.sms.cuentaSid}:token-de-prueba`).toString('base64')}`);
  assert.equal(sms.datos.To, '+50688776655');
  assert.equal(sms.datos.From, '+15005550006');
  const codigo = /\b(\d{6})\b/.exec(sms.datos.Body)[1];
  assert.equal((await navegador.post('/api/perfil/telefono/confirmar', { codigo })).status, 200);
});

test('Twilio de prueba con número no verificado: 503 que explica el motivo', async () => {
  respuestaTwilio = { status: 400, cuerpo: { code: 21608, message: 'The number is unverified. Trial accounts cannot send messages to unverified numbers' } };
  try {
    const { navegador } = await sesionReal('cliente');
    const r = await navegador.post('/api/perfil/telefono', { telefono: '+50661112222' });
    assert.equal(r.status, 503);
    assert.match(r.body.message, /verificado en Twilio/);
  } finally {
    respuestaTwilio = { status: 201, cuerpo: { sid: 'SM123', status: 'queued' } };
  }
});

test('Modo consola: nunca se activa en producción aunque MFA_MODO_CONSOLA=true', () => {
  const leer = (entorno) =>
    execFileSync(process.execPath, ['--input-type=module', '-e', "import { configuracion } from './src/config/env.js'; console.log(JSON.stringify(configuracion.seguridad))"], {
      env: { ...process.env, NODE_ENV: entorno, MFA_MODO_CONSOLA: 'true' },
      cwd: new URL('..', import.meta.url).pathname
    }).toString();
  const produccion = JSON.parse(leer('production'));
  assert.equal(produccion.mfaModoConsola, false);
  assert.equal(produccion.mfaModoConsolaPedidoEnProduccion, true);
  assert.equal(JSON.parse(leer('development')).mfaModoConsola, true);
});
