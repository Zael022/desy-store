// Herramientas compartidas por las pruebas automáticas.
// IMPORTANTE: cada archivo de prueba debe importar './entorno.js' ANTES que este.
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import { configuracion } from '../src/config/env.js';
import { usarCapturaDePrueba } from '../src/servicios/notificaciones.js';
import { generarHashContrasena } from '../src/servicios/contrasenas.js';
import { separarInstrucciones, migrar } from '../database/migrar.js';
import { sembrar } from '../database/seed.js';

export { app, pool };

if (configuracion.entorno !== 'test' || !/prueba/.test(configuracion.db.nombre)) {
  throw new Error('Las pruebas solo corren con NODE_ENV=test y una base cuyo nombre contenga "prueba". Importe tests/entorno.js primero.');
}

// ---------------------------------------------------------------------
// Buzón: aquí llegan los correos y SMS "enviados" durante las pruebas.
// ---------------------------------------------------------------------
export const buzon = [];
usarCapturaDePrueba((mensaje) => {
  buzon.push(mensaje);
  return { modoConsola: false };
});

export function ultimoMensaje(para) {
  const mensaje = [...buzon].reverse().find((m) => m.para === para);
  if (!mensaje) throw new Error(`No llegó ningún mensaje para ${para}.`);
  return mensaje;
}
export const ultimoCodigo = (para) => /\b(\d{6})\b/.exec(ultimoMensaje(para).texto)[1];
export const ultimoToken = (para) => /token=([A-Za-z0-9_-]+)/.exec(ultimoMensaje(para).texto)[1];

// ---------------------------------------------------------------------
// Base de datos de pruebas: se borra y se crea de cero (script.sql + migraciones + seed).
// ---------------------------------------------------------------------
export async function prepararBase() {
  const nombre = configuracion.db.nombre;
  const conexion = await mysql.createConnection({
    host: configuracion.db.host,
    port: configuracion.db.puerto,
    user: configuracion.db.usuario,
    password: configuracion.db.contrasena
  });
  try {
    await conexion.query(`DROP DATABASE IF EXISTS \`${nombre}\``);
    const script = (await fs.readFile(new URL('../database/script.sql', import.meta.url), 'utf8')).replaceAll('inventario_bisuteria', nombre);
    for (const instruccion of separarInstrucciones(script)) await conexion.query(instruccion);
  } finally {
    await conexion.end();
  }
  await migrar({ silencioso: true });
  await sembrar({ silencioso: true });
  buzon.length = 0;
}

export async function cerrar() {
  await pool.end();
}

// ---------------------------------------------------------------------
// "Navegador" de prueba: guarda cookies y manda el token CSRF.
// ---------------------------------------------------------------------
export class Navegador {
  constructor() {
    this.agente = request.agent(app);
    this.csrf = null;
  }

  async obtenerCsrf() {
    const r = await this.agente.get('/api/auth/csrf');
    this.csrf = r.body.csrfToken;
    return this.csrf;
  }

  get(ruta) {
    return this.agente.get(ruta);
  }

  async enviar(metodo, ruta, cuerpo, { sinCsrf = false } = {}) {
    if (!this.csrf && !sinCsrf) await this.obtenerCsrf();
    let peticion = this.agente[metodo](ruta);
    if (!sinCsrf) peticion = peticion.set('X-CSRF-Token', this.csrf);
    const respuesta = await (cuerpo === undefined ? peticion : peticion.send(cuerpo));
    if (respuesta.body?.csrfToken) this.csrf = respuesta.body.csrfToken; // el login y el logout lo renuevan
    return respuesta;
  }

  post(ruta, cuerpo, opciones) { return this.enviar('post', ruta, cuerpo, opciones); }
  put(ruta, cuerpo, opciones) { return this.enviar('put', ruta, cuerpo, opciones); }
  patch(ruta, cuerpo, opciones) { return this.enviar('patch', ruta, cuerpo, opciones); }
  delete(ruta, cuerpo, opciones) { return this.enviar('delete', ruta, cuerpo, opciones); }
}

// ---------------------------------------------------------------------
// Cuentas de prueba (solo existen en la base de pruebas, nunca en el seed).
// ---------------------------------------------------------------------
let contador = 0;
export const CONTRASENA_PRUEBA = `Prueba-${Date.now()}-ok`;

// rol: cliente | proveedor | ventas | administrador | duena
export async function crearCuenta(rol, { idProveedor = 2, telefono = null, contrasena = CONTRASENA_PRUEBA } = {}) {
  contador += 1;
  const correo = `${rol}.${contador}.${Date.now()}@prueba.test`;
  const hash = await generarHashContrasena(contrasena);
  let idEmpleado = null;
  if (['ventas', 'administrador', 'duena'].includes(rol)) {
    const [empleado] = await pool.execute(
      'INSERT INTO empleados (nombre, puesto, correo) VALUES (?, ?, ?)',
      [`Prueba ${rol} ${contador}`, rol, correo]
    );
    idEmpleado = empleado.insertId;
  }
  const [usuario] = await pool.execute(
    `INSERT INTO usuarios (correo, hash_contrasena, rol, correo_verificado, telefono, telefono_verificado, id_empleado, id_proveedor)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
    [correo, hash, rol, telefono, telefono ? 1 : 0, idEmpleado, rol === 'proveedor' ? idProveedor : null]
  );
  let idCliente = null;
  if (rol === 'cliente') {
    const [cliente] = await pool.execute('INSERT INTO clientes (id_usuario, nombre) VALUES (?, ?)', [usuario.insertId, `Cliente de prueba ${contador}`]);
    idCliente = cliente.insertId;
  }
  return { correo, contrasena, rol, idUsuario: usuario.insertId, idEmpleado, idCliente, idProveedor: rol === 'proveedor' ? idProveedor : null };
}

// Login completo: contraseña + código MFA (leído del buzón). Devuelve la respuesta del paso final.
export async function iniciarSesion(navegador, { correo, contrasena }, { canal = 'correo', telefono = null } = {}) {
  const login = await navegador.post('/api/auth/login', { correo, contrasena });
  if (login.status !== 200 || login.body.estado !== 'mfa') throw new Error(`Login falló: ${login.status} ${JSON.stringify(login.body)}`);
  const envio = await navegador.post('/api/auth/mfa/enviar', { canal });
  if (envio.status !== 200) throw new Error(`Envío MFA falló: ${envio.status} ${JSON.stringify(envio.body)}`);
  const codigo = ultimoCodigo(canal === 'sms' ? telefono : correo);
  const verificacion = await navegador.post('/api/auth/mfa/verificar', { codigo });
  if (verificacion.status !== 200) throw new Error(`Verificación MFA falló: ${verificacion.status} ${JSON.stringify(verificacion.body)}`);
  return verificacion;
}

// Atajo: crea una cuenta del rol y devuelve un navegador con la sesión ya iniciada.
export async function sesionDe(rol, opciones) {
  const cuenta = await crearCuenta(rol, opciones);
  const navegador = new Navegador();
  await iniciarSesion(navegador, cuenta);
  return { navegador, cuenta };
}

export async function stockDe(idProducto) {
  const [filas] = await pool.execute('SELECT stock FROM productos WHERE id_producto = ?', [idProducto]);
  return filas[0].stock;
}

// Las cuentas del seed no tienen contraseña. En las pruebas se les pone una
// (solo en la base de pruebas) para poder usarlas.
export async function activarCuentaDelSeed(correo, contrasena = CONTRASENA_PRUEBA) {
  const hash = await generarHashContrasena(contrasena);
  await pool.execute('UPDATE usuarios SET hash_contrasena = ?, correo_verificado = 1 WHERE correo = ?', [hash, correo]);
  const [filas] = await pool.execute('SELECT id_usuario, rol, id_empleado, id_proveedor FROM usuarios WHERE correo = ?', [correo]);
  const navegador = new Navegador();
  await iniciarSesion(navegador, { correo, contrasena });
  return { navegador, cuenta: { correo, contrasena, idUsuario: filas[0].id_usuario, rol: filas[0].rol, idEmpleado: filas[0].id_empleado, idProveedor: filas[0].id_proveedor } };
}
