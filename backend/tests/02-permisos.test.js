// Pruebas de permisos por rol (RBAC), CSRF, registro y gestión de cuentas.
import './entorno.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, prepararBase, cerrar, pool, Navegador, crearCuenta, sesionDe, ultimoCodigo, ultimoToken, buzon, activarCuentaDelSeed } from './ayudante.js';
import { PERMISOS } from '../src/config/permisos.js';

before(prepararBase);
after(cerrar);

// Para cada rol: una ruta permitida (200) y una prohibida (403).
const CASOS_POR_ROL = {
  cliente: { permitida: '/api/mis-compras', prohibida: '/api/productos' },
  proveedor: { permitida: '/api/portal-proveedor/productos', prohibida: '/api/ventas' },
  ventas: { permitida: '/api/punto-venta/productos', prohibida: '/api/usuarios' },
  administrador: { permitida: '/api/reportes/operativo', prohibida: '/api/reportes/ejecutivo' },
  duena: { permitida: '/api/reportes/ejecutivo', prohibida: '/api/mis-compras' }
};

for (const [rol, { permitida, prohibida }] of Object.entries(CASOS_POR_ROL)) {
  test(`Rol ${rol}: ${permitida} -> 200 y ${prohibida} -> 403`, async () => {
    const { navegador } = await sesionDe(rol);
    const si = await navegador.get(permitida);
    assert.equal(si.status, 200, `${permitida}: ${JSON.stringify(si.body).slice(0, 200)}`);
    const no = await navegador.get(prohibida);
    assert.equal(no.status, 403, `${prohibida}: ${no.status}`);
    assert.equal(no.body.message, 'No tiene permiso para hacer esto.');
  });
}

test('Sin sesión: TODAS las rutas protegidas de la matriz responden 401', async () => {
  const protegidas = PERMISOS.filter((r) => Array.isArray(r.acceso));
  assert.ok(protegidas.length > 60);
  for (const regla of protegidas) {
    const ruta = regla.ruta.replace(/:[a-z_]+/g, '1');
    const r = await request(app)[regla.metodo.toLowerCase()](ruta).send({});
    // Las que cambian datos podrían fallar antes por CSRF (403); se manda el token para aislar el 401.
    if (r.status === 403) {
      const navegador = new Navegador();
      const conCsrf = await navegador.enviar(regla.metodo.toLowerCase(), ruta, {});
      assert.equal(conCsrf.status, 401, `${regla.metodo} ${ruta}`);
    } else {
      assert.equal(r.status, 401, `${regla.metodo} ${ruta} respondió ${r.status}`);
    }
  }
});

test('Rutas que no están en la matriz no existen (404)', async () => {
  const { navegador } = await sesionDe('duena');
  assert.equal((await navegador.get('/api/no-existe')).status, 404);
  assert.equal((await navegador.patch('/api/categorias/1', {})).status, 404);
});

test('CSRF: un POST sin token se rechaza (403) aunque haya sesión', async () => {
  const { navegador } = await sesionDe('administrador');
  const sinToken = await navegador.post('/api/categorias', { nombre: `Sin CSRF ${Date.now()}` }, { sinCsrf: true });
  assert.equal(sinToken.status, 403);
  assert.match(sinToken.body.message, /CSRF/);
  const tokenFalso = await navegador.agente.post('/api/categorias').set('X-CSRF-Token', 'falso').send({ nombre: 'x' });
  assert.equal(tokenFalso.status, 403);
  const conToken = await navegador.post('/api/categorias', { nombre: `Con CSRF ${Date.now()}` });
  assert.equal(conToken.status, 201);
});

test('Proveedor: solo ve SUS productos y solicitudes; las de otro proveedor dan 404', async () => {
  const { navegador } = await activarCuentaDelSeed('manosdemar@example.com'); // proveedor 3: Taller Artesanal Manos de Mar
  const productos = await navegador.get('/api/portal-proveedor/productos');
  assert.equal(productos.status, 200);
  const [deEl] = await pool.query('SELECT id_producto FROM productos WHERE id_proveedor = 3');
  assert.deepEqual(productos.body.map((p) => p.id_producto).sort(), deEl.map((p) => p.id_producto).sort());
  assert.ok(productos.body.every((p) => !('stock' in p) && !('costo_unitario' in p) && !('precio' in p)));

  // Solicitud 1 del seed es del proveedor 1: para el proveedor 3 "no existe".
  assert.equal((await navegador.get('/api/portal-proveedor/solicitudes/1')).status, 404);
  assert.equal((await navegador.patch('/api/portal-proveedor/solicitudes/1/respuesta', { decision: 'aceptada' })).status, 404);
  // La 2 sí es suya.
  assert.equal((await navegador.get('/api/portal-proveedor/solicitudes/2')).status, 200);
  const lista = await navegador.get('/api/portal-proveedor/solicitudes');
  assert.ok(lista.body.every((s) => s.id_proveedor === 3));

  // Aunque mande otro id_proveedor en el cuerpo, edita solo sus datos.
  const datos = await navegador.put('/api/portal-proveedor/datos', { id_proveedor: 1, contacto: 'Sofía A.', telefono: '8800-0003', correo: 'manosdemar@example.com', direccion: 'Esparza' });
  assert.equal(datos.status, 200);
  assert.equal(datos.body.id_proveedor, 3);
  const [p1] = await pool.query('SELECT contacto FROM proveedores WHERE id_proveedor = 1');
  assert.equal(p1[0].contacto, 'Laura Méndez');
});

test('Cliente: no puede ver el historial de otro cliente (404) y no ve costos', async () => {
  const { navegador } = await sesionDe('cliente');
  // Ventas del seed son de Camila y José: para este cliente no existen.
  const [ventas] = await pool.query('SELECT id_venta FROM ventas');
  for (const v of ventas) {
    assert.equal((await navegador.get(`/api/mis-compras/${v.id_venta}`)).status, 404);
  }
  const lista = await navegador.get('/api/mis-compras');
  assert.deepEqual(lista.body, []);
  // El catálogo nunca muestra el stock exacto, el costo ni el proveedor.
  const catalogo = await request(app).get('/api/catalogo');
  assert.equal(catalogo.status, 200);
  for (const p of catalogo.body) {
    assert.ok(!('stock' in p) && !('costo_unitario' in p) && !('id_proveedor' in p));
    assert.ok(['disponible', 'pocas', 'agotado'].includes(p.disponibilidad));
  }
});

test('Registro público: aunque mande rol "duena", la cuenta es de cliente y debe verificar el correo', async () => {
  const navegador = new Navegador();
  const correo = `nueva.${Date.now()}@prueba.test`;
  const r = await navegador.post('/api/auth/registro', { nombre: 'Intrusa', correo, contrasena: 'MiClave-2026', rol: 'duena', id_empleado: 1 });
  assert.equal(r.status, 201);
  const [filas] = await pool.execute('SELECT rol, correo_verificado, id_empleado FROM usuarios WHERE correo = ?', [correo]);
  assert.equal(filas[0].rol, 'cliente');
  assert.equal(filas[0].id_empleado, null);
  assert.equal(filas[0].correo_verificado, 0);

  // Sin verificar el correo no puede entrar.
  const login = await navegador.post('/api/auth/login', { correo, contrasena: 'MiClave-2026' });
  assert.equal(login.body.estado, 'verificar_correo');
  assert.equal((await navegador.post('/api/auth/verificar-correo', { correo, codigo: ultimoCodigo(correo) })).status, 200);
  const despues = await navegador.post('/api/auth/login', { correo, contrasena: 'MiClave-2026' });
  assert.equal(despues.body.estado, 'mfa');
});

test('Registro con un correo que ya existe responde igual (no lo delata)', async () => {
  const cuenta = await crearCuenta('cliente');
  const nueva = await new Navegador().post('/api/auth/registro', { nombre: 'A', correo: `otra.${Date.now()}@prueba.test`, contrasena: 'MiClave-2026' });
  const repetida = await new Navegador().post('/api/auth/registro', { nombre: 'B', correo: cuenta.correo, contrasena: 'MiClave-2026' });
  assert.equal(repetida.status, nueva.status);
  assert.equal(repetida.body.message, nueva.body.message);
});

test('Administrador: no puede crear cuentas de administrador ni de dueña (403); sí de ventas', async () => {
  const { navegador } = await sesionDe('administrador');
  const [empleado] = await pool.execute("INSERT INTO empleados (nombre, puesto, correo) VALUES ('Nueva', 'Vendedora', ?)", [`emp.${Date.now()}@prueba.test`]);
  for (const rol of ['administrador', 'duena']) {
    const r = await navegador.post('/api/usuarios/invitaciones', { rol, correo: `${rol}.${Date.now()}@prueba.test`, id_empleado: empleado.insertId });
    assert.equal(r.status, 403, rol);
  }
  const correo = `vendedora.${Date.now()}@prueba.test`;
  const ok = await navegador.post('/api/usuarios/invitaciones', { rol: 'ventas', correo, id_empleado: empleado.insertId });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.ok(!('hash_contrasena' in ok.body));

  // La persona acepta la invitación (enlace de un solo uso) y queda con el correo verificado.
  const token = ultimoToken(correo);
  const publico = new Navegador();
  assert.equal((await publico.post('/api/auth/invitacion/validar', { token })).body.rol, 'ventas');
  assert.equal((await publico.post('/api/auth/invitacion/aceptar', { token, contrasena: 'Vendedora-2026' })).status, 200);
  assert.equal((await publico.post('/api/auth/invitacion/aceptar', { token, contrasena: 'Otra-2026-xx' })).status, 400);
  const login = await publico.post('/api/auth/login', { correo, contrasena: 'Vendedora-2026' });
  assert.equal(login.body.estado, 'mfa');
});

test('Administrador: no puede desactivar administradores/dueña ni a sí mismo; desactivar ventas cierra sus sesiones', async () => {
  const { navegador, cuenta: admin } = await sesionDe('administrador');
  const otroAdmin = await crearCuenta('administrador');
  const duena = await crearCuenta('duena');
  assert.equal((await navegador.patch(`/api/usuarios/${otroAdmin.idUsuario}/estado`, { activo: false })).status, 403);
  assert.equal((await navegador.patch(`/api/usuarios/${duena.idUsuario}/estado`, { activo: false })).status, 403);
  assert.equal((await navegador.patch(`/api/usuarios/${admin.idUsuario}/estado`, { activo: false })).status, 400);
  assert.equal((await navegador.patch(`/api/usuarios/${otroAdmin.idUsuario}/rol`, { rol: 'duena' })).status, 403);

  const { navegador: navVentas, cuenta: ventas } = await sesionDe('ventas');
  assert.equal((await navVentas.get('/api/ventas')).status, 200);
  assert.equal((await navegador.patch(`/api/usuarios/${ventas.idUsuario}/estado`, { activo: false })).status, 200);
  assert.equal((await navVentas.get('/api/ventas')).status, 401);
});

test('Dueña: cambia roles internos; la única dueña activa no puede quitarse el rol', async () => {
  await pool.query("UPDATE usuarios SET activo = 0 WHERE rol = 'duena'");
  const { navegador, cuenta: duena } = await sesionDe('duena');
  const quitarse = await navegador.patch(`/api/usuarios/${duena.idUsuario}/rol`, { rol: 'administrador' });
  assert.equal(quitarse.status, 409);
  assert.equal((await navegador.patch(`/api/usuarios/${duena.idUsuario}/estado`, { activo: false })).status, 400);

  const ventas = await crearCuenta('ventas');
  const subir = await navegador.patch(`/api/usuarios/${ventas.idUsuario}/rol`, { rol: 'administrador' });
  assert.equal(subir.status, 200);
  assert.equal(subir.body.rol, 'administrador');
  // No se puede convertir un cliente o un proveedor en cuenta interna.
  const cliente = await crearCuenta('cliente');
  assert.equal((await navegador.patch(`/api/usuarios/${cliente.idUsuario}/rol`, { rol: 'ventas' })).status, 400);
  // Queda en auditoría.
  const [auditoria] = await pool.query("SELECT detalle FROM auditoria WHERE accion = 'rol_cambiado' ORDER BY id_auditoria DESC LIMIT 1");
  assert.match(auditoria[0].detalle, /Administrador/);
});

test('Costos: solo la dueña los ve y los cambia', async () => {
  const { navegador: admin } = await sesionDe('administrador');
  const lista = await admin.get('/api/productos');
  assert.ok(lista.body.every((p) => !('costo_unitario' in p)));
  const producto = (await admin.get('/api/productos/1')).body;
  const datos = { codigo: producto.codigo, nombre: producto.nombre, descripcion: producto.descripcion, precio: producto.precio, id_categoria: producto.id_categoria, id_proveedor: producto.id_proveedor, id_material: producto.id_material };
  assert.equal((await admin.put('/api/productos/1', { ...datos, costo_unitario: 1 })).status, 403);
  assert.equal((await admin.put('/api/productos/1', datos)).status, 200);
  const [antes] = await pool.query('SELECT costo_unitario FROM productos WHERE id_producto = 1');
  assert.equal(antes[0].costo_unitario, 4200, 'editar sin costo no borra el costo');

  const { navegador: duena } = await sesionDe('duena');
  const conCosto = await duena.put('/api/productos/1', { ...datos, costo_unitario: 4300 });
  assert.equal(conCosto.status, 200);
  assert.equal(conCosto.body.costo_unitario, 4300);
});

test('Recuperar contraseña: misma respuesta exista o no el correo; el enlace sirve una vez y cierra sesiones', async () => {
  const { navegador, cuenta } = await sesionDe('cliente');
  const publico = new Navegador();
  const existe = await publico.post('/api/auth/recuperar', { correo: cuenta.correo });
  const noExiste = await publico.post('/api/auth/recuperar', { correo: `nadie.${Date.now()}@prueba.test` });
  assert.equal(existe.status, 200);
  assert.equal(existe.body.message, noExiste.body.message);

  const token = ultimoToken(cuenta.correo);
  assert.equal((await publico.post('/api/auth/restablecer', { token, contrasena: 'NuevaClave-2026' })).status, 200);
  assert.equal((await publico.post('/api/auth/restablecer', { token, contrasena: 'OtraClave-2026' })).status, 400);
  assert.equal((await navegador.get('/api/perfil')).status, 401, 'la sesión anterior se cerró');
  assert.equal((await publico.post('/api/auth/login', { correo: cuenta.correo, contrasena: 'NuevaClave-2026' })).body.estado, 'mfa');
});

test('Perfil: cambiar la contraseña pide la actual y cierra las otras sesiones', async () => {
  const cuenta = await crearCuenta('ventas');
  const { iniciarSesion } = await import('./ayudante.js');
  const pc = new Navegador();
  const celular = new Navegador();
  await iniciarSesion(pc, cuenta);
  await iniciarSesion(celular, cuenta);
  assert.equal((await pc.put('/api/perfil/contrasena', { actual: 'incorrecta1', nueva: 'NuevaClave-2026' })).status, 400);
  assert.equal((await pc.put('/api/perfil/contrasena', { actual: cuenta.contrasena, nueva: 'NuevaClave-2026' })).status, 200);
  assert.equal((await pc.get('/api/perfil')).status, 200, 'la sesión actual sigue');
  assert.equal((await celular.get('/api/perfil')).status, 401, 'la otra sesión se cerró');
});

test('Perfil: verificar teléfono por SMS y cambiar el correo con código al correo nuevo', async () => {
  const { navegador, cuenta } = await sesionDe('cliente');
  assert.equal((await navegador.post('/api/perfil/telefono', { telefono: '+506 8811-2233' })).status, 200);
  assert.equal((await navegador.post('/api/perfil/telefono/confirmar', { codigo: ultimoCodigo('+50688112233') })).status, 200);
  const perfil = await navegador.get('/api/perfil');
  assert.equal(perfil.body.telefono_verificado, true);

  const nuevo = `cambiado.${Date.now()}@prueba.test`;
  assert.equal((await navegador.post('/api/perfil/correo', { correo_nuevo: nuevo, contrasena: cuenta.contrasena })).status, 200);
  assert.equal((await navegador.post('/api/perfil/correo/confirmar', { codigo: ultimoCodigo(nuevo) })).status, 200);
  assert.equal((await navegador.get('/api/perfil')).body.correo, nuevo);
});

test('Auditoría: registra logins y nunca guarda contraseñas ni códigos', async () => {
  const { navegador } = await sesionDe('administrador');
  const r = await navegador.get('/api/auditoria');
  assert.equal(r.status, 200);
  assert.ok(r.body.registros.some((a) => a.accion === 'login_exitoso'));
  const [todo] = await pool.query('SELECT detalle FROM auditoria WHERE detalle IS NOT NULL');
  const texto = todo.map((a) => a.detalle).join(' ');
  assert.ok(!texto.includes('Prueba-'), 'no debe aparecer ninguna contraseña de prueba');
  const codigosEnviados = buzon.map((m) => /\b(\d{6})\b/.exec(m.texto)?.[1]).filter(Boolean);
  assert.ok(codigosEnviados.length > 10);
  for (const codigo of codigosEnviados) assert.ok(!texto.includes(codigo), `el código ${codigo} no debe estar en la auditoría`);
});

test('Configuración: solo la dueña la cambia; queda en auditoría y afecta al catálogo', async () => {
  const { navegador: admin } = await sesionDe('administrador');
  assert.equal((await admin.get('/api/configuracion/sistema')).status, 200);
  assert.equal((await admin.put('/api/configuracion/sistema', { umbral_pocas_unidades: 20 })).status, 403);

  const { navegador: duena } = await sesionDe('duena');
  const r = await duena.put('/api/configuracion/sistema', { umbral_pocas_unidades: 30, proveedor_ve_stock: true, mensaje_catalogo: 'Hola' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.find((c) => c.clave === 'umbral_pocas_unidades').valor, 30);
  assert.equal((await duena.put('/api/configuracion/sistema', { umbral_pocas_unidades: 68 })).status, 400);
  assert.equal((await duena.put('/api/configuracion/sistema', { otra_cosa: 1 })).status, 400);
  const publica = await request(app).get('/api/configuracion');
  assert.equal(publica.body.umbral_pocas_unidades, 30);
  assert.equal(publica.body.stock_maximo, 67);
  const [auditoria] = await pool.query("SELECT COUNT(*) AS total FROM auditoria WHERE accion = 'configuracion_cambiada'");
  assert.ok(auditoria[0].total >= 1);
  await duena.put('/api/configuracion/sistema', { umbral_pocas_unidades: 5, proveedor_ve_stock: false });
});

test('Editar cuenta: corregir el correo de una invitación pendiente (no de cuentas activas)', async () => {
  const { navegador: admin } = await sesionDe('administrador');
  const [empleado] = await pool.execute("INSERT INTO empleados (nombre, puesto, correo) VALUES ('Correo malo', 'Vendedora', ?)", [`malo.${Date.now()}@prueba.test`]);
  const equivocado = `equivocado.${Date.now()}@prueba.test`;
  const creada = await admin.post('/api/usuarios/invitaciones', { rol: 'ventas', correo: equivocado, id_empleado: empleado.insertId });
  assert.equal(creada.status, 201);
  const tokenViejo = ultimoToken(equivocado);
  const correcto = `correcto.${Date.now()}@prueba.test`;
  const r = await admin.patch(`/api/usuarios/${creada.body.id_usuario}/correo`, { correo: correcto });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.correo, correcto);
  assert.equal((await new Navegador().post('/api/auth/invitacion/validar', { token: tokenViejo })).status, 400, 'la invitación vieja queda anulada');
  assert.equal((await admin.post(`/api/usuarios/${creada.body.id_usuario}/invitacion`)).status, 200);
  assert.ok(ultimoToken(correcto));

  const activa = await crearCuenta('ventas');
  assert.equal((await admin.patch(`/api/usuarios/${activa.idUsuario}/correo`, { correo: `x.${Date.now()}@prueba.test` })).status, 409);
  const otroAdmin = await crearCuenta('administrador');
  assert.equal((await admin.patch(`/api/usuarios/${otroAdmin.idUsuario}/correo`, { correo: `y.${Date.now()}@prueba.test` })).status, 403);
});
