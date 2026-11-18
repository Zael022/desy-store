// Pruebas del segundo factor (MFA) y del login.
import './entorno.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, prepararBase, cerrar, pool, Navegador, crearCuenta, iniciarSesion, ultimoCodigo, buzon } from './ayudante.js';

before(prepararBase);
after(cerrar);

// Paso 1 del login (correo + contraseña) y paso 2 (enviar el código por correo).
async function hastaElCodigo(cuenta) {
  const navegador = new Navegador();
  const login = await navegador.post('/api/auth/login', { correo: cuenta.correo, contrasena: cuenta.contrasena });
  assert.equal(login.status, 200);
  assert.equal(login.body.estado, 'mfa');
  const envio = await navegador.post('/api/auth/mfa/enviar', { canal: 'correo' });
  assert.equal(envio.status, 200, JSON.stringify(envio.body));
  return navegador;
}

test('MFA: código correcto crea la sesión y devuelve el rol y su pantalla', async () => {
  const cuenta = await crearCuenta('ventas');
  const navegador = await hastaElCodigo(cuenta);
  const r = await navegador.post('/api/auth/mfa/verificar', { codigo: ultimoCodigo(cuenta.correo) });
  assert.equal(r.status, 200);
  assert.equal(r.body.usuario.rol, 'ventas');
  assert.equal(r.body.destino, '/pos');
  assert.ok(!JSON.stringify(r.body).includes('hash'), 'la respuesta no debe incluir hashes');
  const sesion = await navegador.get('/api/auth/sesion');
  assert.equal(sesion.status, 200);
  assert.equal(sesion.body.usuario.correo, cuenta.correo);
});

test('MFA: código incorrecto -> 400 y no hay sesión', async () => {
  const cuenta = await crearCuenta('cliente');
  const navegador = await hastaElCodigo(cuenta);
  const real = ultimoCodigo(cuenta.correo);
  const falso = real === '000000' ? '111111' : '000000';
  const r = await navegador.post('/api/auth/mfa/verificar', { codigo: falso });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /Le quedan 4 intento/);
  assert.equal((await navegador.get('/api/auth/sesion')).status, 401);
});

test('MFA: código vencido -> 400', async () => {
  const cuenta = await crearCuenta('cliente');
  const navegador = await hastaElCodigo(cuenta);
  await pool.execute("UPDATE codigos_verificacion SET expira_en = NOW() - INTERVAL 1 MINUTE WHERE id_usuario = ? AND proposito = 'mfa'", [cuenta.idUsuario]);
  const r = await navegador.post('/api/auth/mfa/verificar', { codigo: ultimoCodigo(cuenta.correo) });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /venció/);
  assert.equal((await navegador.get('/api/auth/sesion')).status, 401);
});

test('MFA: un código ya usado no sirve otra vez', async () => {
  const cuenta = await crearCuenta('cliente');
  const navegador = await hastaElCodigo(cuenta);
  const codigo = ultimoCodigo(cuenta.correo);
  assert.equal((await navegador.post('/api/auth/mfa/verificar', { codigo })).status, 200);
  // Mismo código otra vez, con un navegador nuevo que vuelve a pasar la contraseña (desafío nuevo).
  const otro = new Navegador();
  await otro.post('/api/auth/login', { correo: cuenta.correo, contrasena: cuenta.contrasena });
  const reuso = await otro.post('/api/auth/mfa/verificar', { codigo });
  assert.equal(reuso.status, 400);
  const [filas] = await pool.execute("SELECT usado FROM codigos_verificacion WHERE id_usuario = ? AND proposito = 'mfa' ORDER BY id_codigo", [cuenta.idUsuario]);
  assert.equal(filas[0].usado, 1);
  // El desafío ya usado tampoco sirve: la cookie se borró y en la base quedó marcado.
  const [desafios] = await pool.execute('SELECT usado FROM desafios_mfa WHERE id_usuario = ? ORDER BY id_desafio', [cuenta.idUsuario]);
  assert.equal(desafios[0].usado, 1);
});

test('MFA: al quinto intento fallido el código se anula (429) y ni el correcto sirve', async () => {
  const cuenta = await crearCuenta('cliente');
  const navegador = await hastaElCodigo(cuenta);
  const real = ultimoCodigo(cuenta.correo);
  const falso = real === '999999' ? '888888' : '999999';
  for (let i = 1; i <= 4; i++) {
    assert.equal((await navegador.post('/api/auth/mfa/verificar', { codigo: falso })).status, 400);
  }
  const quinto = await navegador.post('/api/auth/mfa/verificar', { codigo: falso });
  assert.equal(quinto.status, 429);
  const despues = await navegador.post('/api/auth/mfa/verificar', { codigo: real });
  assert.equal(despues.status, 400);
  assert.match(despues.body.message, /No hay un código vigente/);
  assert.equal((await navegador.get('/api/auth/sesion')).status, 401);
});

test('MFA: reenviar antes de 60 segundos -> 429', async () => {
  const cuenta = await crearCuenta('cliente');
  const navegador = await hastaElCodigo(cuenta);
  const r = await navegador.post('/api/auth/mfa/enviar', { canal: 'correo' });
  assert.equal(r.status, 429);
  assert.match(r.body.message, /Espere \d+ segundos/);
});

test('MFA: al pedir un código nuevo, el anterior deja de servir', async () => {
  const cuenta = await crearCuenta('cliente');
  const navegador = await hastaElCodigo(cuenta);
  const viejo = ultimoCodigo(cuenta.correo);
  // Simulamos que pasaron 61 segundos.
  await pool.execute('UPDATE codigos_verificacion SET creado_en = NOW() - INTERVAL 61 SECOND WHERE id_usuario = ?', [cuenta.idUsuario]);
  assert.equal((await navegador.post('/api/auth/mfa/enviar', { canal: 'correo' })).status, 200);
  const nuevo = ultimoCodigo(cuenta.correo);
  if (viejo !== nuevo) {
    const conViejo = await navegador.post('/api/auth/mfa/verificar', { codigo: viejo });
    assert.equal(conViejo.status, 400);
  }
  assert.equal((await navegador.post('/api/auth/mfa/verificar', { codigo: nuevo })).status, 200);
});

test('MFA: el código se guarda solo como hash (nunca el número)', async () => {
  const cuenta = await crearCuenta('cliente');
  await hastaElCodigo(cuenta);
  const codigo = ultimoCodigo(cuenta.correo);
  const [filas] = await pool.execute('SELECT hash_codigo FROM codigos_verificacion WHERE id_usuario = ?', [cuenta.idUsuario]);
  assert.equal(filas[0].hash_codigo.length, 64);
  assert.notEqual(filas[0].hash_codigo, codigo);
});

test('MFA: SMS solo si el teléfono está verificado', async () => {
  const sinTelefono = await crearCuenta('cliente');
  const navegador = new Navegador();
  const login = await navegador.post('/api/auth/login', { correo: sinTelefono.correo, contrasena: sinTelefono.contrasena });
  assert.deepEqual(login.body.canales.map((c) => c.canal), ['correo']);
  assert.equal((await navegador.post('/api/auth/mfa/enviar', { canal: 'sms' })).status, 400);

  const conTelefono = await crearCuenta('cliente', { telefono: '+50688001122' });
  const otro = new Navegador();
  const r = await iniciarSesion(otro, conTelefono, { canal: 'sms', telefono: '+50688001122' });
  assert.equal(r.status, 200);
  assert.equal(buzon.at(-1).canal, 'sms');
  // En el login el teléfono se muestra enmascarado (solo los últimos dígitos).
  const login2 = await new Navegador().post('/api/auth/login', { correo: conTelefono.correo, contrasena: conTelefono.contrasena });
  const sms = login2.body.canales.find((c) => c.canal === 'sms');
  assert.ok(sms && !sms.destino.includes('8800'), sms?.destino);
});

test('Login: error genérico para correo inexistente y para contraseña incorrecta', async () => {
  const cuenta = await crearCuenta('cliente');
  const navegador = new Navegador();
  const inexistente = await navegador.post('/api/auth/login', { correo: 'nadie@prueba.test', contrasena: 'loquesea123' });
  const incorrecta = await navegador.post('/api/auth/login', { correo: cuenta.correo, contrasena: 'incorrecta123' });
  assert.equal(inexistente.status, 401);
  assert.equal(incorrecta.status, 401);
  assert.equal(inexistente.body.message, 'Correo o contraseña incorrectos.');
  assert.equal(incorrecta.body.message, inexistente.body.message);
});

test('Login: tras 5 contraseñas incorrectas la cuenta se bloquea, aunque después la contraseña sea correcta', async () => {
  const cuenta = await crearCuenta('cliente');
  const navegador = new Navegador();
  for (let i = 1; i <= 4; i++) {
    assert.equal((await navegador.post('/api/auth/login', { correo: cuenta.correo, contrasena: `mala-${i}-xyz` })).status, 401);
  }
  assert.equal((await navegador.post('/api/auth/login', { correo: cuenta.correo, contrasena: 'mala-5-xyz' })).status, 429);
  const correcta = await navegador.post('/api/auth/login', { correo: cuenta.correo, contrasena: cuenta.contrasena });
  assert.equal(correcta.status, 429);
  assert.match(correcta.body.message, /15 minutos/);
});

test('Login: un correo inexistente también se "bloquea" igual (no delata si existe)', async () => {
  const navegador = new Navegador();
  const correo = `fantasma.${Date.now()}@prueba.test`;
  for (let i = 1; i <= 4; i++) {
    assert.equal((await navegador.post('/api/auth/login', { correo, contrasena: 'cualquiera123' })).status, 401);
  }
  // Al quinto intento: 429, exactamente igual que una cuenta real.
  assert.equal((await navegador.post('/api/auth/login', { correo, contrasena: 'cualquiera123' })).status, 429);
  assert.equal((await navegador.post('/api/auth/login', { correo, contrasena: 'cualquiera123' })).status, 429);
});

test('Login: el desafío MFA no sirve para rutas protegidas (solo contraseña = sin acceso)', async () => {
  const cuenta = await crearCuenta('duena');
  const navegador = new Navegador();
  const login = await navegador.post('/api/auth/login', { correo: cuenta.correo, contrasena: cuenta.contrasena });
  assert.equal(login.status, 200);
  for (const ruta of ['/api/auth/sesion', '/api/perfil', '/api/productos', '/api/reportes/ejecutivo', '/api/usuarios', '/api/ventas']) {
    const r = await navegador.get(ruta);
    assert.equal(r.status, 401, `${ruta} debería responder 401`);
  }
  assert.equal((await navegador.post('/api/categorias', { nombre: 'Intento sin MFA' })).status, 401);
});

test('Logout revoca la sesión en el servidor', async () => {
  const cuenta = await crearCuenta('cliente');
  const navegador = new Navegador();
  const final = await iniciarSesion(navegador, cuenta);
  const galleta = final.headers['set-cookie'].find((c) => c.startsWith('desy_sesion='));
  assert.ok(galleta, 'debe existir la cookie de sesión');
  assert.match(galleta, /HttpOnly/);
  assert.match(galleta, /SameSite=Lax/);
  const valor = galleta.split(';')[0];
  assert.equal((await navegador.post('/api/auth/logout')).status, 200);
  // Aunque alguien guardara la cookie vieja, el servidor ya no la acepta.
  const conCookieVieja = await request(app).get('/api/auth/sesion').set('Cookie', valor);
  assert.equal(conCookieVieja.status, 401);
});

test('Sesión: vence por inactividad (30 min) y al desactivar la cuenta', async () => {
  const cuenta = await crearCuenta('cliente');
  const navegador = new Navegador();
  await iniciarSesion(navegador, cuenta);
  await pool.execute('UPDATE sesiones SET ultima_actividad = NOW() - INTERVAL 31 MINUTE WHERE id_usuario = ?', [cuenta.idUsuario]);
  const vencida = await navegador.get('/api/perfil');
  assert.equal(vencida.status, 401);
  assert.match(vencida.body.message, /expiró/);

  const otra = await crearCuenta('cliente');
  const nav2 = new Navegador();
  await iniciarSesion(nav2, otra);
  await pool.execute('UPDATE usuarios SET activo = 0 WHERE id_usuario = ?', [otra.idUsuario]);
  assert.equal((await nav2.get('/api/perfil')).status, 401);
});
