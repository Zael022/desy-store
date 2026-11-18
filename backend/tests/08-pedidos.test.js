// Pruebas de los pedidos de clientes: apartar unidades, confirmar, rechazar,
// entregar (venta), cancelar, vencer, avisos por correo y permisos.
import './entorno.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { app, prepararBase, cerrar, pool, sesionDe, stockDe, buzon } from './ayudante.js';
import { vencerYAvisar } from '../src/controllers/pedidoController.js';

let cliente; // { navegador, cuenta }
let otroCliente;
let ventas;
let idAretes; // ARE-001
let idCollar; // COL-001

before(async () => {
  await prepararBase();
  cliente = await sesionDe('cliente');
  otroCliente = await sesionDe('cliente');
  ventas = await sesionDe('ventas');
  idAretes = await idDe('ARE-001');
  idCollar = await idDe('COL-001');
});
after(cerrar);

async function idDe(codigo) {
  const [filas] = await pool.execute('SELECT id_producto FROM productos WHERE codigo = ?', [codigo]);
  return filas[0].id_producto;
}

const pedir = (navegador, items, extra = {}) =>
  navegador.post('/api/mis-pedidos', { clave_idempotencia: crypto.randomUUID(), items, ...extra });

async function apartadoDe(id) {
  const { navegador } = await sesionDe('administrador');
  return (await navegador.get(`/api/productos/${id}`)).body.apartado;
}

// Lo que el punto de venta deja vender (stock - apartado).
async function disponibleEnPos(id, codigo) {
  const r = await ventas.navegador.get(`/api/punto-venta/productos?buscar=${codigo}`);
  return r.body.find((p) => p.id_producto === id).stock;
}

// Minutos que faltan para que venza (lo calcula MySQL, con su propia hora).
async function minutosParaVencer(idPedido) {
  const [[fila]] = await pool.execute('SELECT TIMESTAMPDIFF(MINUTE, NOW(), vence_en) AS minutos FROM pedidos WHERE id_pedido = ?', [idPedido]);
  return fila.minutos;
}

const avisosPara = (correo, palabra) => buzon.filter((m) => m.para === correo && m.asunto.includes(palabra));

test('Pedido: aparta las unidades sin cambiar el stock y queda pendiente', async () => {
  const stock = await stockDe(idAretes);
  const r = await pedir(cliente.navegador, [{ id_producto: idAretes, cantidad: 2 }], { nota: 'Lo recojo el sábado' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.estado, 'pendiente');
  assert.equal(r.body.unidades, 2);
  assert.equal(r.body.detalle[0].cantidad, 2);
  assert.equal(r.body.nota_cliente, 'Lo recojo el sábado');
  const minutos = await minutosParaVencer(r.body.id_pedido);
  assert.ok(minutos > 47 * 60 && minutos <= 48 * 60, `vence en 48 horas (${minutos} min)`);

  assert.equal(await stockDe(idAretes), stock, 'el stock físico no cambia');
  assert.equal(await apartadoDe(idAretes), 2);
  assert.equal(await disponibleEnPos(idAretes, 'ARE-001'), stock - 2);
  assert.equal(avisosPara(cliente.cuenta.correo, 'Recibimos su pedido').length, 1, 'aviso de recibido');

  const mios = await cliente.navegador.get('/api/mis-pedidos');
  assert.equal(mios.body.length, 1);
  assert.equal((await otroCliente.navegador.get('/api/mis-pedidos')).body.length, 0, 'cada cliente ve solo los suyos');
  assert.equal((await otroCliente.navegador.get(`/api/mis-pedidos/${r.body.id_pedido}`)).status, 404);
});

test('Pedido: la misma clave dos veces no aparta dos veces', async () => {
  const clave = crypto.randomUUID();
  const primero = await otroCliente.navegador.post('/api/mis-pedidos', { clave_idempotencia: clave, items: [{ id_producto: idCollar, cantidad: 1 }] });
  const segundo = await otroCliente.navegador.post('/api/mis-pedidos', { clave_idempotencia: clave, items: [{ id_producto: idCollar, cantidad: 1 }] });
  assert.equal(primero.status, 201);
  assert.equal(segundo.status, 200);
  assert.equal(segundo.body.repetido, true);
  assert.equal(segundo.body.id_pedido, primero.body.id_pedido);
  assert.equal(await apartadoDe(idCollar), 1);
  // Cancelado para no estorbar a las demás pruebas.
  assert.equal((await otroCliente.navegador.patch(`/api/mis-pedidos/${primero.body.id_pedido}/cancelar`)).status, 200);
  assert.equal(await apartadoDe(idCollar), 0);
});

test('Lo apartado no se puede pedir, vender ni sacar a mano', async () => {
  const stock = await stockDe(idAretes);
  const apartado = await apartadoDe(idAretes);
  const libres = stock - apartado;

  // Otro cliente pide una más de las libres -> 409 y no se guarda nada.
  const mucho = await pedir(otroCliente.navegador, [{ id_producto: idAretes, cantidad: Math.min(libres + 1, 10) }]);
  if (libres + 1 <= 10) {
    assert.equal(mucho.status, 409);
    assert.match(mucho.body.message, /solo quedan/);
  }

  // Punto de venta: vender más de lo libre -> 409 que menciona lo apartado.
  const venta = await ventas.navegador.post('/api/ventas', { clave_idempotencia: crypto.randomUUID(), items: [{ id_producto: idAretes, cantidad: libres + 1 }] });
  assert.equal(venta.status, 409);
  assert.match(venta.body.message, /apartadas en pedidos/);

  // Movimiento de salida a mano que se lleva unidades apartadas -> 409.
  const { navegador: admin, cuenta } = await sesionDe('administrador');
  const salida = await admin.post('/api/movimientos', { id_producto: idAretes, id_empleado: cuenta.idEmpleado, tipo: 'salida', cantidad: libres + 1, fecha: '2026-11-10', motivo: 'Prueba' });
  assert.equal(salida.status, 409);
  assert.match(salida.body.message, /apartadas en pedidos de clientes/);
  assert.equal(await stockDe(idAretes), stock, 'nada cambió');
});

test('Confirmar, entregar con el precio del pedido y quedar en "Mis compras"', async () => {
  const stock = await stockDe(idCollar);
  const pedido = (await pedir(cliente.navegador, [{ id_producto: idCollar, cantidad: 2 }])).body;
  const precioPedido = pedido.detalle[0].precio_unitario;

  // Entregar sin confirmar -> 409.
  assert.equal((await ventas.navegador.patch(`/api/pedidos/${pedido.id_pedido}/entregar`)).status, 409);

  const confirmado = await ventas.navegador.patch(`/api/pedidos/${pedido.id_pedido}/confirmar`);
  assert.equal(confirmado.status, 200, JSON.stringify(confirmado.body));
  assert.equal(confirmado.body.estado, 'confirmado');
  assert.equal(confirmado.body.avisado, true);
  const minutos = await minutosParaVencer(pedido.id_pedido);
  assert.ok(minutos > 7 * 24 * 60 - 5 && minutos <= 7 * 24 * 60, `plazo de 7 días para recoger (${minutos} min)`);
  assert.equal(avisosPara(cliente.cuenta.correo, 'está confirmado').length, 1);
  assert.equal((await ventas.navegador.patch(`/api/pedidos/${pedido.id_pedido}/confirmar`)).status, 409, 'no se confirma dos veces');
  assert.equal(await apartadoDe(idCollar), 2, 'sigue apartado hasta la entrega');

  // Si el precio sube después, se cobra el del pedido.
  await pool.execute('UPDATE productos SET precio = precio + 1000 WHERE id_producto = ?', [idCollar]);
  const entregado = await ventas.navegador.patch(`/api/pedidos/${pedido.id_pedido}/entregar`);
  assert.equal(entregado.status, 200, JSON.stringify(entregado.body));
  assert.equal(entregado.body.estado, 'entregado');
  assert.ok(entregado.body.id_venta);
  assert.equal(await stockDe(idCollar), stock - 2, 'la venta descontó el stock');
  assert.equal(await apartadoDe(idCollar), 0);

  const [[detalle]] = await pool.execute('SELECT precio_unitario, cantidad FROM detalle_ventas WHERE id_venta = ?', [entregado.body.id_venta]);
  assert.equal(Number(detalle.precio_unitario), precioPedido);
  const [[mov]] = await pool.execute('SELECT tipo, cantidad, id_venta FROM movimientos WHERE id_venta = ?', [entregado.body.id_venta]);
  assert.deepEqual({ ...mov }, { tipo: 'salida', cantidad: 2, id_venta: entregado.body.id_venta });

  const compras = await cliente.navegador.get('/api/mis-compras');
  assert.ok(compras.body.some((c) => c.id_venta === entregado.body.id_venta), 'la venta aparece en "Mis compras" del cliente');
  assert.equal((await ventas.navegador.patch(`/api/pedidos/${pedido.id_pedido}/entregar`)).status, 409, 'no se entrega dos veces');
  assert.equal((await cliente.navegador.patch(`/api/mis-pedidos/${pedido.id_pedido}/cancelar`)).status, 409, 'un entregado no se cancela');
});

test('Rechazar pide motivo, libera las unidades y avisa al cliente', async () => {
  const pedido = (await pedir(otroCliente.navegador, [{ id_producto: idCollar, cantidad: 1 }])).body;
  assert.equal((await ventas.navegador.patch(`/api/pedidos/${pedido.id_pedido}/rechazar`, {})).status, 400);
  assert.equal((await ventas.navegador.patch(`/api/pedidos/${pedido.id_pedido}/rechazar`, { motivo: 'x' })).status, 400);
  const r = await ventas.navegador.patch(`/api/pedidos/${pedido.id_pedido}/rechazar`, { motivo: 'El collar tiene un defecto' });
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'rechazado');
  assert.equal(r.body.motivo, 'El collar tiene un defecto');
  assert.equal(await apartadoDe(idCollar), 0);
  const aviso = avisosPara(otroCliente.cuenta.correo, 'no se pudo atender').at(-1);
  assert.match(aviso.texto, /tiene un defecto/);
  assert.equal((await ventas.navegador.patch(`/api/pedidos/${pedido.id_pedido}/confirmar`)).status, 409);
});

test('Vencimiento: lo vencido se libera al instante y se marca y avisa al revisar', async () => {
  const pedido = (await pedir(otroCliente.navegador, [{ id_producto: idCollar, cantidad: 1 }])).body;
  assert.equal(await apartadoDe(idCollar), 1);
  await pool.execute('UPDATE pedidos SET vence_en = NOW() - INTERVAL 1 MINUTE WHERE id_pedido = ?', [pedido.id_pedido]);
  assert.equal(await apartadoDe(idCollar), 0, 'un pedido vencido ya no aparta, aunque no se haya revisado');
  assert.equal((await ventas.navegador.patch(`/api/pedidos/${pedido.id_pedido}/confirmar`)).status, 409);

  assert.equal(await vencerYAvisar(), 1);
  const [[fila]] = await pool.execute('SELECT estado, motivo FROM pedidos WHERE id_pedido = ?', [pedido.id_pedido]);
  assert.equal(fila.estado, 'vencido');
  assert.match(fila.motivo, /no lo confirmó a tiempo/);
  await new Promise((r) => setTimeout(r, 100)); // el aviso se envía sin esperar
  assert.equal(avisosPara(otroCliente.cuenta.correo, 'venció').length, 1);
  assert.equal(await vencerYAvisar(), 0, 'no se vence dos veces');
});

test('Máximo 3 pedidos en curso por cliente; cancelar libera el cupo', async () => {
  const { navegador } = await sesionDe('cliente');
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const r = await pedir(navegador, [{ id_producto: idCollar, cantidad: 1 }]);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    ids.push(r.body.id_pedido);
  }
  const cuarto = await pedir(navegador, [{ id_producto: idCollar, cantidad: 1 }]);
  assert.equal(cuarto.status, 409);
  assert.match(cuarto.body.message, /3 pedidos en curso/);
  assert.equal((await navegador.patch(`/api/mis-pedidos/${ids[0]}/cancelar`)).status, 200);
  assert.equal((await pedir(navegador, [{ id_producto: idCollar, cantidad: 1 }])).status, 201);
});

test('Validaciones del pedido', async () => {
  const { navegador } = await sesionDe('cliente');
  assert.equal((await navegador.post('/api/mis-pedidos', { items: [{ id_producto: idCollar, cantidad: 1 }] })).status, 400, 'sin clave');
  assert.equal((await pedir(navegador, [])).status, 400, 'sin productos');
  assert.equal((await pedir(navegador, [{ id_producto: idCollar, cantidad: 0 }])).status, 400, 'cantidad 0');
  assert.equal((await pedir(navegador, [{ id_producto: idCollar, cantidad: 11 }])).status, 400, 'más de 10 unidades');
  assert.equal((await pedir(navegador, [{ id_producto: idCollar, cantidad: 1 }, { id_producto: idCollar, cantidad: 1 }])).status, 400, 'repetido');
  assert.equal((await pedir(navegador, [{ id_producto: 999999, cantidad: 1 }])).status, 400, 'no existe');
  assert.equal((await pedir(navegador, [{ id_producto: idCollar, cantidad: 1 }], { nota: 'x'.repeat(256) })).status, 400, 'nota larga');
  // Un producto agotado.
  const agotado = await idDe('COL-002');
  const r = await pedir(navegador, [{ id_producto: agotado, cantidad: 1 }]);
  assert.equal(r.status, 409);
  assert.match(r.body.message, /ya no tiene unidades disponibles/);
  const [[n]] = await pool.query('SELECT COUNT(*) AS n FROM pedidos WHERE nota_cliente LIKE "xxx%"');
  assert.equal(n.n, 0);
});

test('Permisos de pedidos', async () => {
  // Solo los clientes piden; solo la tienda atiende.
  assert.equal((await cliente.navegador.get('/api/pedidos')).status, 403);
  assert.equal((await cliente.navegador.patch('/api/pedidos/1/confirmar')).status, 403);
  assert.equal((await ventas.navegador.post('/api/mis-pedidos', { clave_idempotencia: crypto.randomUUID(), items: [{ id_producto: idCollar, cantidad: 1 }] })).status, 403);
  const { navegador: proveedor } = await sesionDe('proveedor');
  assert.equal((await proveedor.get('/api/pedidos')).status, 403);
  assert.equal((await proveedor.get('/api/mis-pedidos')).status, 403);
  assert.equal((await request(app).get('/api/pedidos')).status, 401);
  assert.equal((await request(app).get('/api/mis-pedidos')).status, 401);
  const sinCsrf = await cliente.navegador.post('/api/mis-pedidos', { clave_idempotencia: crypto.randomUUID(), items: [{ id_producto: idCollar, cantidad: 1 }] }, { sinCsrf: true });
  assert.equal(sinCsrf.status, 403);
  // El cliente sale de la sesión: aunque mande id_cliente de otro, el pedido es suyo.
  const r = await pedir(cliente.navegador, [{ id_producto: idCollar, cantidad: 1 }], { id_cliente: otroCliente.cuenta.idCliente });
  assert.equal(r.status, 201);
  assert.equal(r.body.id_cliente, cliente.cuenta.idCliente);
  // Administración y dueña también atienden; filtros de la bandeja.
  for (const rol of ['administrador', 'duena']) {
    const { navegador } = await sesionDe(rol);
    assert.equal((await navegador.get('/api/pedidos?filtro=pendientes')).status, 200, rol);
  }
  assert.equal((await ventas.navegador.get('/api/pedidos?filtro=raro')).status, 400);
  const resumen = await ventas.navegador.get('/api/pedidos/resumen');
  assert.equal(resumen.status, 200);
  assert.ok(resumen.body.pendientes >= 1);
});

test('Configuración: la dueña cambia el plazo para confirmar', async () => {
  const { navegador: duena } = await sesionDe('duena');
  assert.equal((await duena.put('/api/configuracion/sistema', { horas_pedido_pendiente: 0 })).status, 400);
  assert.equal((await duena.put('/api/configuracion/sistema', { horas_pedido_pendiente: 2 })).status, 200);
  const { navegador } = await sesionDe('cliente');
  const r = await pedir(navegador, [{ id_producto: idCollar, cantidad: 1 }]);
  const minutos = await minutosParaVencer(r.body.id_pedido);
  assert.ok(minutos > 115 && minutos <= 120, `vence en 2 horas (${minutos} min)`);
  const { navegador: admin } = await sesionDe('administrador');
  assert.equal((await admin.put('/api/configuracion/sistema', { horas_pedido_pendiente: 5 })).status, 403, 'solo la dueña');
});
