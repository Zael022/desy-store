// =====================================================================
// Pruebas del inventario ORIGINAL (las mismas 135 comprobaciones de la
// versión 1: CRUD de las 6 entidades, reglas del stock, transacciones,
// máximo de 67, errores 400/404/409 y CORS), ahora con sesión de
// administrador (contraseña + MFA) y token CSRF.
//
// Cambio de la versión 2: el empleado de cada movimiento sale de la sesión.
// Por eso la antigua prueba "empleado que no existe -> 400" ahora comprueba
// que el id_empleado enviado por el navegador se IGNORA.
// =====================================================================
import './entorno.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararBase, cerrar, sesionDe } from './ayudante.js';

let navegador;
let cuentaAdmin;
const SUFIJO = Date.now().toString().slice(-6); // para que los nombres no choquen
const resultados = [];

// Hace una petición y devuelve { status, datos, headers }.
// Hace una petición con la sesión del administrador y devuelve { status, datos, headers }.
async function peticion(metodo, ruta, cuerpo, opciones = {}) {
  const url = `/api${ruta}`;
  let r;
  if (opciones.cuerpoCrudo !== undefined) {
    if (!navegador.csrf) await navegador.obtenerCsrf();
    r = await navegador.agente[metodo.toLowerCase()](url).set('X-CSRF-Token', navegador.csrf).set('Content-Type', 'application/json').send(opciones.cuerpoCrudo);
  } else if (metodo === 'GET') {
    let req = navegador.get(url);
    for (const [k, v] of Object.entries(opciones.headers || {})) req = req.set(k, v);
    r = await req;
  } else {
    r = await navegador.enviar(metodo.toLowerCase(), url, cuerpo);
  }
  const datos = r.body && Object.keys(r.body).length > 0 ? r.body : (r.text ? (() => { try { return JSON.parse(r.text); } catch { return { noEsJson: r.text }; } })() : {});
  return { status: r.status, datos, headers: { get: (nombre) => r.headers[nombre.toLowerCase()] ?? null } };
}

function verificar(grupo, descripcion, condicion, detalle = '') {
  resultados.push({ grupo, descripcion, ok: Boolean(condicion), detalle });
}

// Comprueba código HTTP y que el error tenga el formato { message }.
function esperarError(grupo, descripcion, r, codigo) {
  const formatoOk = typeof r.datos.message === 'string' && Object.keys(r.datos).length === 1;
  verificar(grupo, `${descripcion} -> ${codigo}`, r.status === codigo && formatoOk, `HTTP ${r.status}: ${r.datos.message}`);
}

async function stockDe(idProducto) {
  const r = await peticion('GET', `/productos/${idProducto}`);
  return r.datos.stock;
}

// ---------------------------------------------------------------------
// Prueba genérica de los 5 endpoints de una entidad.
// ---------------------------------------------------------------------
async function probarCrud({ grupo, ruta, llave, nuevo, cambios, campoVacio, campoTipo }) {
  // POST
  const creado = await peticion('POST', ruta, nuevo);
  verificar(grupo, 'POST crea el registro -> 201', creado.status === 201 && creado.datos[llave] > 0, `HTTP ${creado.status} ${JSON.stringify(creado.datos).slice(0, 120)}`);
  const id = creado.datos[llave];

  // GET lista
  const lista = await peticion('GET', ruta);
  verificar(grupo, 'GET lista -> 200 con arreglo que incluye el nuevo', lista.status === 200 && Array.isArray(lista.datos) && lista.datos.some((x) => x[llave] === id), `HTTP ${lista.status}, ${lista.datos.length} registros`);

  // GET uno
  const uno = await peticion('GET', `${ruta}/${id}`);
  verificar(grupo, 'GET por id -> 200', uno.status === 200 && uno.datos[llave] === id, `HTTP ${uno.status}`);

  // PUT con cambios
  const actualizado = await peticion('PUT', `${ruta}/${id}`, { ...nuevo, ...cambios });
  const [campoCambio, valorCambio] = Object.entries(cambios)[0];
  verificar(grupo, 'PUT actualiza -> 200 con el registro actualizado', actualizado.status === 200 && actualizado.datos[campoCambio] === valorCambio, `HTTP ${actualizado.status} ${campoCambio}=${actualizado.datos[campoCambio]}`);

  // PUT sin cambios (no debe confundirse con "no existe")
  const sinCambios = await peticion('PUT', `${ruta}/${id}`, { ...nuevo, ...cambios });
  verificar(grupo, 'PUT sin cambiar nada -> 200 (no 404)', sinCambios.status === 200, `HTTP ${sinCambios.status}`);

  // Errores comunes
  esperarError(grupo, `POST con "${campoVacio}" solo con espacios`, await peticion('POST', ruta, { ...nuevo, [campoVacio]: '   ' }), 400);
  esperarError(grupo, `POST con "${campoTipo.campo}" de tipo incorrecto`, await peticion('POST', ruta, { ...nuevo, [campoTipo.campo]: campoTipo.valor }), 400);
  esperarError(grupo, 'POST duplicado', await peticion('POST', ruta, { ...nuevo, ...cambios }), 409);
  esperarError(grupo, 'GET id inexistente', await peticion('GET', `${ruta}/999999`), 404);
  esperarError(grupo, 'GET id inválido ("abc")', await peticion('GET', `${ruta}/abc`), 400);
  esperarError(grupo, 'GET id inválido ("0")', await peticion('GET', `${ruta}/0`), 400);
  esperarError(grupo, 'PUT id inexistente', await peticion('PUT', `${ruta}/999999`, nuevo), 404);
  esperarError(grupo, 'DELETE id inexistente', await peticion('DELETE', `${ruta}/999999`), 404);

  return id;
}

async function eliminarYVerificar(grupo, ruta, id) {
  const borrado = await peticion('DELETE', `${ruta}/${id}`);
  verificar(grupo, 'DELETE -> 200 con confirmación JSON', borrado.status === 200 && typeof borrado.datos.message === 'string', `HTTP ${borrado.status}: ${borrado.datos.message}`);
  const otraVez = await peticion('GET', `${ruta}/${id}`);
  verificar(grupo, 'Después de DELETE, GET -> 404', otraVez.status === 404, `HTTP ${otraVez.status}`);
}

async function main() {
  const salud = await peticion('GET', '/salud');
  verificar('Configuración', 'GET /salud -> 200', salud.status === 200);

  const config = await peticion('GET', '/configuracion');
  const MAX = config.datos.stock_maximo;
  verificar('Configuración', `GET /configuracion devuelve el stock máximo (${MAX})`, config.status === 200 && Number.isInteger(MAX));

  // ---------------- Entidades sin reglas de stock ----------------
  const idCategoria = await probarCrud({
    grupo: 'Categorías', ruta: '/categorias', llave: 'id_categoria',
    nuevo: { nombre: `ZZ Prueba categoría ${SUFIJO}`, descripcion: 'Creada por el script de pruebas' },
    cambios: { nombre: `ZZ Prueba categoría editada ${SUFIJO}` },
    campoVacio: 'nombre', campoTipo: { campo: 'nombre', valor: 123 }
  });
  esperarError('Categorías', 'POST con nombre de 61 caracteres', await peticion('POST', '/categorias', { nombre: 'x'.repeat(61) }), 400);
  esperarError('Categorías', 'POST duplicado con otras mayúsculas ("ARETES")', await peticion('POST', '/categorias', { nombre: 'ARETES' }), 409);

  const idProveedor = await probarCrud({
    grupo: 'Proveedores', ruta: '/proveedores', llave: 'id_proveedor',
    nuevo: { nombre: `ZZ Prueba proveedor ${SUFIJO}`, contacto: 'Ana', telefono: '2661-9999', correo: `zz${SUFIJO}@example.com`, direccion: 'Puntarenas' },
    cambios: { telefono: '2661-8888' },
    campoVacio: 'telefono', campoTipo: { campo: 'telefono', valor: 26610000 }
  });
  esperarError('Proveedores', 'POST con correo sin formato', await peticion('POST', '/proveedores', { nombre: `ZZ otro ${SUFIJO}`, telefono: '2661-0000', correo: 'correo-malo' }), 400);
  esperarError('Proveedores', 'POST con teléfono de letras', await peticion('POST', '/proveedores', { nombre: `ZZ otro ${SUFIJO}`, telefono: 'abcdefghij' }), 400);

  const idMaterial = await probarCrud({
    grupo: 'Materiales', ruta: '/materiales', llave: 'id_material',
    nuevo: { nombre: `ZZ Prueba material ${SUFIJO}`, es_hipoalergenico: false, descripcion: null },
    cambios: { es_hipoalergenico: true },
    campoVacio: 'nombre', campoTipo: { campo: 'es_hipoalergenico', valor: 'sí' }
  });

  const idEmpleado = await probarCrud({
    grupo: 'Empleados', ruta: '/empleados', llave: 'id_empleado',
    nuevo: { nombre: `ZZ Prueba empleado ${SUFIJO}`, puesto: 'Vendedora', telefono: null, correo: `zzemp${SUFIJO}@example.com` },
    cambios: { puesto: 'Encargada de bodega' },
    campoVacio: 'puesto', campoTipo: { campo: 'correo', valor: true }
  });

  // ---------------- Productos ----------------
  const baseProducto = {
    codigo: `ZZ-${SUFIJO}`, nombre: 'ZZ Prueba producto', descripcion: null, precio: 4500.5,
    id_categoria: idCategoria, id_proveedor: idProveedor, id_material: idMaterial
  };
  const idProducto = await probarCrud({
    grupo: 'Productos', ruta: '/productos', llave: 'id_producto',
    nuevo: baseProducto,
    cambios: { precio: 5000 },
    campoVacio: 'nombre', campoTipo: { campo: 'precio', valor: 'cinco mil' }
  });
  verificar('Productos', 'Un producto nuevo empieza con stock 0', (await stockDe(idProducto)) === 0);
  esperarError('Productos', 'POST con categoría que no existe (FK)', await peticion('POST', '/productos', { ...baseProducto, codigo: `ZY-${SUFIJO}`, id_categoria: 999999 }), 400);
  esperarError('Productos', 'POST con proveedor que no existe (FK)', await peticion('POST', '/productos', { ...baseProducto, codigo: `ZY-${SUFIJO}`, id_proveedor: 999999 }), 400);
  esperarError('Productos', 'POST con precio negativo', await peticion('POST', '/productos', { ...baseProducto, codigo: `ZY-${SUFIJO}`, precio: -1 }), 400);
  esperarError('Productos', 'POST con precio de 3 decimales', await peticion('POST', '/productos', { ...baseProducto, codigo: `ZY-${SUFIJO}`, precio: 10.555 }), 400);
  esperarError('Productos', 'POST con código con espacios', await peticion('POST', '/productos', { ...baseProducto, codigo: 'ZZ 01' }), 400);
  esperarError('Productos', 'POST que intenta poner stock directamente', await peticion('POST', '/productos', { ...baseProducto, codigo: `ZY-${SUFIJO}`, stock: 10 }), 400);
  esperarError('Productos', 'PUT que intenta cambiar el stock directamente', await peticion('PUT', `/productos/${idProducto}`, { ...baseProducto, stock: 10 }), 400);
  verificar('Productos', 'El stock sigue en 0 después de los intentos', (await stockDe(idProducto)) === 0);

  // Segundo producto para probar el cambio de producto en un movimiento.
  const otro = await peticion('POST', '/productos', { ...baseProducto, codigo: `ZX-${SUFIJO}`, nombre: 'ZZ Prueba producto B' });
  const idProductoB = otro.datos.id_producto;

  // ---------------- Movimientos y reglas del stock ----------------
  const G = 'Movimientos';
  // id_empleado se manda a propósito: el backend debe ignorarlo y usar el de la sesión.
  const mov = (tipo, cantidad, idProd = idProducto) => ({ id_producto: idProd, id_empleado: idEmpleado, tipo, cantidad, fecha: '2026-11-04', motivo: 'Prueba automática' });

  const entrada = await peticion('POST', '/movimientos', mov('entrada', 60));
  verificar(G, 'POST entrada normal de 60 -> 201 y stock 60', entrada.status === 201 && (await stockDe(idProducto)) === 60, `HTTP ${entrada.status}`);
  const idEntrada = entrada.datos.id_movimiento;

  esperarError(G, `POST entrada que supera ${MAX} (60 + 10)`, await peticion('POST', '/movimientos', mov('entrada', 10)), 409);
  verificar(G, 'El stock sigue en 60 después de la entrada rechazada', (await stockDe(idProducto)) === 60);

  const salida = await peticion('POST', '/movimientos', mov('salida', 25));
  verificar(G, 'POST salida normal de 25 -> 201 y stock 35', salida.status === 201 && (await stockDe(idProducto)) === 35, `HTTP ${salida.status}`);
  const idSalida = salida.datos.id_movimiento;

  esperarError(G, 'POST salida que deja el stock negativo (35 - 40)', await peticion('POST', '/movimientos', mov('salida', 40)), 409);
  verificar(G, 'El stock sigue en 35 después de la salida rechazada', (await stockDe(idProducto)) === 35);

  const lista = await peticion('GET', '/movimientos');
  verificar(G, 'GET lista -> 200 con arreglo', lista.status === 200 && Array.isArray(lista.datos) && lista.datos.some((m) => m.id_movimiento === idSalida));
  const uno = await peticion('GET', `/movimientos/${idSalida}`);
  verificar(G, 'GET por id -> 200 con el stock actual del producto', uno.status === 200 && uno.datos.stock_actual === 35);

  const edit1 = await peticion('PUT', `/movimientos/${idSalida}`, mov('salida', 30));
  verificar(G, 'PUT salida 25 -> 30: revierte y aplica, stock 30', edit1.status === 200 && (await stockDe(idProducto)) === 30, `HTTP ${edit1.status}`);
  const sinCambio = await peticion('PUT', `/movimientos/${idSalida}`, mov('salida', 30));
  verificar(G, 'PUT sin cambiar nada -> 200 y el stock no cambia', sinCambio.status === 200 && (await stockDe(idProducto)) === 30);
  const edit2 = await peticion('PUT', `/movimientos/${idSalida}`, mov('entrada', 5));
  verificar(G, 'PUT salida 30 -> entrada 5: stock 65', edit2.status === 200 && (await stockDe(idProducto)) === 65, `HTTP ${edit2.status}`);
  esperarError(G, `PUT entrada 5 -> entrada 10 (pasaría a 70 > ${MAX})`, await peticion('PUT', `/movimientos/${idSalida}`, mov('entrada', 10)), 409);
  verificar(G, 'El stock sigue en 65 después del PUT rechazado', (await stockDe(idProducto)) === 65);

  const borrado = await peticion('DELETE', `/movimientos/${idEntrada}`);
  verificar(G, 'DELETE de la entrada de 60 revierte su efecto: stock 5', borrado.status === 200 && (await stockDe(idProducto)) === 5, `HTTP ${borrado.status}: ${borrado.datos.message}`);

  const salida5 = await peticion('POST', '/movimientos', mov('salida', 5));
  verificar(G, 'POST salida de 5 deja el stock en 0 (mínimo permitido)', salida5.status === 201 && (await stockDe(idProducto)) === 0);
  esperarError(G, 'DELETE de una entrada cuyas unidades ya salieron (quedaría -5)', await peticion('DELETE', `/movimientos/${idSalida}`), 409);
  verificar(G, 'El stock sigue en 0 después del DELETE rechazado', (await stockDe(idProducto)) === 0);

  // Cambiar el producto de un movimiento.
  const entradaB = await peticion('POST', '/movimientos', mov('entrada', 10, idProductoB));
  verificar(G, 'POST entrada de 10 en el producto B -> 201', entradaB.status === 201, `HTTP ${entradaB.status}`);
  const moverAB = await peticion('PUT', `/movimientos/${salida5.datos.id_movimiento}`, mov('salida', 5, idProductoB));
  verificar(G, 'PUT que cambia de producto: A vuelve a 5 y B baja a 5', moverAB.status === 200 && (await stockDe(idProducto)) === 5 && (await stockDe(idProductoB)) === 5, `HTTP ${moverAB.status}`);
  esperarError(G, 'PUT que cambia de producto pero B quedaría negativo', await peticion('PUT', `/movimientos/${idSalida}`, mov('salida', 50, idProductoB)), 409);
  verificar(G, 'Transacción: tras el rechazo, ni A ni B cambiaron (5 y 5)', (await stockDe(idProducto)) === 5 && (await stockDe(idProductoB)) === 5);

  esperarError(G, 'POST con tipo inválido', await peticion('POST', '/movimientos', { ...mov('entrada', 1), tipo: 'regalo' }), 400);
  esperarError(G, 'POST con cantidad 0', await peticion('POST', '/movimientos', mov('entrada', 0)), 400);
  esperarError(G, 'POST con cantidad decimal', await peticion('POST', '/movimientos', mov('entrada', 2.5)), 400);
  esperarError(G, 'POST con cantidad como texto', await peticion('POST', '/movimientos', mov('entrada', '3')), 400);
  esperarError(G, 'POST con fecha imposible (2026-02-30)', await peticion('POST', '/movimientos', { ...mov('entrada', 1), fecha: '2026-02-30' }), 400);
  esperarError(G, 'POST con fecha sin formato', await peticion('POST', '/movimientos', { ...mov('entrada', 1), fecha: '04/11/2026' }), 400);
  esperarError(G, 'POST con producto que no existe (FK)', await peticion('POST', '/movimientos', mov('entrada', 1, 999999)), 400);
  const conEmpleadoFalso = await peticion('POST', '/movimientos', { ...mov('entrada', 1), id_empleado: 999999 });
  verificar(G, 'POST con id_empleado inventado: se ignora y se usa el empleado de la sesión -> 201', conEmpleadoFalso.status === 201 && conEmpleadoFalso.datos.id_empleado === cuentaAdmin.idEmpleado, `HTTP ${conEmpleadoFalso.status} empleado=${conEmpleadoFalso.datos.id_empleado}`);
  await peticion('DELETE', `/movimientos/${conEmpleadoFalso.datos.id_movimiento}`);
  esperarError(G, 'POST sin datos', await peticion('POST', '/movimientos', {}), 400);
  esperarError(G, 'GET id inexistente', await peticion('GET', '/movimientos/999999'), 404);
  esperarError(G, 'PUT id inexistente', await peticion('PUT', '/movimientos/999999', mov('entrada', 1)), 404);
  esperarError(G, 'DELETE id inexistente', await peticion('DELETE', '/movimientos/999999'), 404);

  // ---------------- Eliminar con dependencias (409) ----------------
  const D = 'Dependencias';
  esperarError(D, 'DELETE categoría con productos', await peticion('DELETE', `/categorias/${idCategoria}`), 409);
  esperarError(D, 'DELETE proveedor con productos', await peticion('DELETE', `/proveedores/${idProveedor}`), 409);
  esperarError(D, 'DELETE material con productos', await peticion('DELETE', `/materiales/${idMaterial}`), 409);
  esperarError(D, 'DELETE producto con movimientos', await peticion('DELETE', `/productos/${idProducto}`), 409);
  esperarError(D, 'DELETE empleado con movimientos (el de la sesión)', await peticion('DELETE', `/empleados/${cuentaAdmin.idEmpleado}`), 409);

  // ---------------- Errores generales ----------------
  const E = 'Errores generales';
  esperarError(E, 'JSON malformado', await peticion('POST', '/categorias', undefined, { cuerpoCrudo: '{"nombre": "sin cerrar"' }), 400);
  esperarError(E, 'Cuerpo que es un arreglo y no un objeto', await peticion('POST', '/categorias', ['a']), 400);
  esperarError(E, 'POST sin cuerpo JSON', await peticion('POST', '/categorias'), 400);
  esperarError(E, 'Ruta inexistente', await peticion('GET', '/no-existe'), 404);
  esperarError(E, 'Método no soportado en una ruta (PATCH)', await peticion('PATCH', '/categorias/1', {}), 404);

  const conOrigen = await peticion('GET', '/categorias', undefined, { headers: { Origin: 'http://localhost:5173' } });
  verificar(E, 'CORS: el origen del .env recibe Access-Control-Allow-Origin', conOrigen.headers.get('access-control-allow-origin') === 'http://localhost:5173', String(conOrigen.headers.get('access-control-allow-origin')));
  verificar(E, 'CORS: no se usa "*"', conOrigen.headers.get('access-control-allow-origin') !== '*');

  // ---------------- Limpieza: borra todo lo creado ----------------
  const L = 'Limpieza';
  const todos = (await peticion('GET', '/movimientos')).datos
    .filter((m) => m.id_producto === idProducto || m.id_producto === idProductoB);
  // Primero las salidas (para que revertir no deje stock negativo) y luego las entradas.
  const enOrden = [...todos.filter((m) => m.tipo === 'salida'), ...todos.filter((m) => m.tipo === 'entrada')];
  for (const m of enOrden) await peticion('DELETE', `/movimientos/${m.id_movimiento}`);
  verificar(L, 'Al borrar todos sus movimientos, el stock vuelve a 0', (await stockDe(idProducto)) === 0 && (await stockDe(idProductoB)) === 0);

  await eliminarYVerificar('Productos', '/productos', idProducto);
  await peticion('DELETE', `/productos/${idProductoB}`);
  await eliminarYVerificar('Categorías', '/categorias', idCategoria);
  await eliminarYVerificar('Proveedores', '/proveedores', idProveedor);
  await eliminarYVerificar('Materiales', '/materiales', idMaterial);
  await eliminarYVerificar('Empleados', '/empleados', idEmpleado);

  return resultados;
}

before(async () => {
  await prepararBase();
  ({ navegador, cuenta: cuentaAdmin } = await sesionDe('administrador'));
});
after(cerrar);

test('Inventario original: CRUD, reglas del stock, transacciones y errores (con rol administrador)', async () => {
  const todas = await main();
  const fallas = todas.filter((r) => !r.ok);
  console.log(`Comprobaciones: ${todas.length}, correctas: ${todas.length - fallas.length}`);
  assert.deepEqual(fallas.map((f) => `${f.grupo}: ${f.descripcion} (${f.detalle})`), []);
  assert.ok(todas.length >= 135, `se esperaban al menos 135 comprobaciones y hubo ${todas.length}`);
});

test('Inventario original: los roles sin permiso reciben 403 (cliente, proveedor y ventas)', async () => {
  for (const rol of ['cliente', 'proveedor', 'ventas']) {
    const { navegador: otro } = await sesionDe(rol);
    assert.equal((await otro.get('/api/categorias')).status, 403, `${rol} GET categorias`);
    assert.equal((await otro.post('/api/movimientos', { id_producto: 1, tipo: 'entrada', cantidad: 1, fecha: '2026-11-05' })).status, 403, `${rol} POST movimientos`);
    assert.equal((await otro.delete('/api/productos/1')).status, 403, `${rol} DELETE productos`);
  }
});
