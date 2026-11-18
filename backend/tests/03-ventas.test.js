// Pruebas de ventas, devoluciones y abastecimiento (y su efecto en el inventario).
import './entorno.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prepararBase, cerrar, pool, sesionDe, stockDe, activarCuentaDelSeed } from './ayudante.js';

after(cerrar);

// Producto nuevo con un stock exacto (creado con un movimiento de entrada real).
async function productoConStock(navegadorAdmin, stock, precio = 1000) {
  const codigo = `T-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`.toUpperCase();
  const r = await navegadorAdmin.post('/api/productos', { codigo, nombre: `Prueba ${codigo}`, descripcion: null, precio, id_categoria: 1, id_proveedor: 2, id_material: 1 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  if (stock > 0) {
    const m = await navegadorAdmin.post('/api/movimientos', { id_producto: r.body.id_producto, tipo: 'entrada', cantidad: stock, fecha: '2026-11-05', motivo: 'Stock de prueba' });
    assert.equal(m.status, 201, JSON.stringify(m.body));
  }
  return r.body.id_producto;
}

let admin;
let vendedor;
before(async () => {
  await prepararBase();
  admin = (await sesionDe('administrador')).navegador;
  vendedor = await sesionDe('ventas');
});

test('Venta normal: guarda venta, detalle con precio y costo del momento y una salida por producto', async () => {
  const p1 = await productoConStock(admin, 10, 2500);
  const p2 = await productoConStock(admin, 5, 1200);
  const r = await vendedor.navegador.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: p1, cantidad: 3 }, { id_producto: p2, cantidad: 1 }] });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.total, 3 * 2500 + 1200);
  assert.equal(r.body.repetida, false);
  assert.ok(r.body.detalle.every((l) => !('costo_unitario' in l)), 'el rol ventas no ve costos');
  assert.equal(await stockDe(p1), 7);
  assert.equal(await stockDe(p2), 4);
  const [movs] = await pool.execute('SELECT id_producto, tipo, cantidad, id_empleado FROM movimientos WHERE id_venta = ? ORDER BY id_producto', [r.body.id_venta]);
  assert.deepEqual(movs.map((m) => [m.id_producto, m.tipo, m.cantidad]), [[p1, 'salida', 3], [p2, 'salida', 1]]);
  assert.ok(movs.every((m) => m.id_empleado === vendedor.cuenta.idEmpleado), 'el empleado sale de la sesión');
});

test('Venta sin stock suficiente -> 409 y no se guarda nada', async () => {
  const p1 = await productoConStock(admin, 2);
  const p2 = await productoConStock(admin, 10);
  const [[{ antes }]] = await pool.query('SELECT COUNT(*) AS antes FROM ventas');
  const r = await vendedor.navegador.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: p2, cantidad: 4 }, { id_producto: p1, cantidad: 3 }] });
  assert.equal(r.status, 409);
  assert.match(r.body.message, /hay 2 disponibles y la venta pide 3/);
  assert.equal(await stockDe(p1), 2);
  assert.equal(await stockDe(p2), 10, 'el otro producto tampoco cambió (transacción)');
  const [[{ despues }]] = await pool.query('SELECT COUNT(*) AS despues FROM ventas');
  assert.equal(despues, antes);
});

test('La misma clave de idempotencia dos veces: una sola venta y una sola salida', async () => {
  const p = await productoConStock(admin, 10);
  const venta = { clave_idempotencia: randomUUID(), items: [{ id_producto: p, cantidad: 2 }] };
  const primera = await vendedor.navegador.post('/api/ventas', venta);
  const segunda = await vendedor.navegador.post('/api/ventas', venta);
  assert.equal(primera.status, 201);
  assert.equal(segunda.status, 200);
  assert.equal(segunda.body.repetida, true);
  assert.equal(segunda.body.id_venta, primera.body.id_venta);
  assert.equal(await stockDe(p), 8);
  // Y también si llegan al mismo tiempo (doble clic).
  const p2 = await productoConStock(admin, 10);
  const doble = { clave_idempotencia: randomUUID(), items: [{ id_producto: p2, cantidad: 1 }] };
  const [a, b] = await Promise.all([vendedor.navegador.post('/api/ventas', doble), vendedor.navegador.post('/api/ventas', doble)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 201]);
  assert.equal(await stockDe(p2), 9);
});

test('Dos ventas simultáneas de la última unidad: solo una gana', async () => {
  const p = await productoConStock(admin, 1);
  const otro = await sesionDe('ventas');
  const [a, b] = await Promise.all([
    vendedor.navegador.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: p, cantidad: 1 }] }),
    otro.navegador.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: p, cantidad: 1 }] })
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  assert.equal(await stockDe(p), 0);
  const [movs] = await pool.execute("SELECT COUNT(*) AS total FROM movimientos WHERE id_producto = ? AND tipo = 'salida'", [p]);
  assert.equal(movs[0].total, 1);
});

test('Validaciones de la venta: sin clave, sin productos, producto repetido, cantidad 0', async () => {
  const p = await productoConStock(admin, 5);
  const v = vendedor.navegador;
  assert.equal((await v.post('/api/ventas', { items: [{ id_producto: p, cantidad: 1 }] })).status, 400);
  assert.equal((await v.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [] })).status, 400);
  assert.equal((await v.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: p, cantidad: 1 }, { id_producto: p, cantidad: 1 }] })).status, 400);
  assert.equal((await v.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: p, cantidad: 0 }] })).status, 400);
  assert.equal((await v.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: 999999, cantidad: 1 }] })).status, 400);
  assert.equal(await stockDe(p), 5);
});

test('Una venta no se edita: sus movimientos no se pueden cambiar ni borrar (409)', async () => {
  const p = await productoConStock(admin, 5);
  const venta = await vendedor.navegador.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: p, cantidad: 1 }] });
  const [[mov]] = await pool.execute('SELECT id_movimiento FROM movimientos WHERE id_venta = ?', [venta.body.id_venta]);
  const put = await admin.put(`/api/movimientos/${mov.id_movimiento}`, { id_producto: p, tipo: 'salida', cantidad: 2, fecha: '2026-11-05', motivo: 'x' });
  assert.equal(put.status, 409);
  assert.match(put.body.message, /devolución/);
  assert.equal((await admin.delete(`/api/movimientos/${mov.id_movimiento}`)).status, 409);
  assert.equal(await stockDe(p), 4);
});

test('Rol ventas: solo ve sus ventas; la de otro vendedor es 404', async () => {
  const p = await productoConStock(admin, 5);
  const otro = await sesionDe('ventas');
  const ajena = await otro.navegador.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: p, cantidad: 1 }] });
  assert.equal((await vendedor.navegador.get(`/api/ventas/${ajena.body.id_venta}`)).status, 404);
  const lista = await vendedor.navegador.get('/api/ventas');
  assert.ok(lista.body.every((v) => v.id_usuario === vendedor.cuenta.idUsuario));
  // Administración sí la ve, sin costos; la dueña la ve con costos.
  assert.equal((await admin.get(`/api/ventas/${ajena.body.id_venta}`)).status, 200);
  const { navegador: duena } = await sesionDe('duena');
  const conCosto = await duena.get(`/api/ventas/${ajena.body.id_venta}`);
  assert.ok('costo_unitario' in conCosto.body.detalle[0]);
  // Y no puede devolver la venta de otro vendedor.
  const devolver = await vendedor.navegador.post('/api/devoluciones', { id_venta: ajena.body.id_venta, motivo: 'x', items: [{ id_detalle_venta: ajena.body.detalle[0].id_detalle_venta, cantidad: 1 }] });
  assert.equal(devolver.status, 404);
});

test('Devolución normal: entrada de inventario enlazada; no se puede devolver más de lo vendido', async () => {
  const p = await productoConStock(admin, 10, 3000);
  const venta = await vendedor.navegador.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: p, cantidad: 4 }] });
  const linea = venta.body.detalle[0].id_detalle_venta;
  assert.equal(await stockDe(p), 6);

  const dev = await vendedor.navegador.post('/api/devoluciones', { id_venta: venta.body.id_venta, motivo: 'Talla incorrecta', items: [{ id_detalle_venta: linea, cantidad: 3 }] });
  assert.equal(dev.status, 201, JSON.stringify(dev.body));
  assert.equal(dev.body.total, 9000);
  assert.equal(await stockDe(p), 9);
  const [movs] = await pool.execute('SELECT tipo, cantidad FROM movimientos WHERE id_devolucion = ?', [dev.body.id_devolucion]);
  assert.deepEqual(movs.map((m) => [m.tipo, m.cantidad]), [['entrada', 3]]);

  const demasiado = await vendedor.navegador.post('/api/devoluciones', { id_venta: venta.body.id_venta, motivo: 'Otra', items: [{ id_detalle_venta: linea, cantidad: 2 }] });
  assert.equal(demasiado.status, 409);
  assert.match(demasiado.body.message, /Solo puede devolver 1/);
  assert.equal(await stockDe(p), 9);
  const sinMotivo = await vendedor.navegador.post('/api/devoluciones', { id_venta: venta.body.id_venta, items: [{ id_detalle_venta: linea, cantidad: 1 }] });
  assert.equal(sinMotivo.status, 400);
});

test('Devolución que pasaría el máximo de 67 -> 409 con explicación y sin cambios', async () => {
  const p = await productoConStock(admin, 10);
  const venta = await vendedor.navegador.post('/api/ventas', { clave_idempotencia: randomUUID(), items: [{ id_producto: p, cantidad: 5 }] });
  // Mientras tanto entraron 62 unidades: stock 5 + 62 = 67.
  await admin.post('/api/movimientos', { id_producto: p, tipo: 'entrada', cantidad: 62, fecha: '2026-11-05', motivo: 'Llegó mercadería' });
  assert.equal(await stockDe(p), 67);
  const dev = await vendedor.navegador.post('/api/devoluciones', { id_venta: venta.body.id_venta, motivo: 'Cambio', items: [{ id_detalle_venta: venta.body.detalle[0].id_detalle_venta, cantidad: 1 }] });
  assert.equal(dev.status, 409);
  assert.match(dev.body.message, /máximo de 67/);
  assert.equal(await stockDe(p), 67);
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM devoluciones WHERE id_venta = ?', [venta.body.id_venta]);
  assert.equal(total, 0);
});

test('Cliente asociado a la venta la ve en "Mis compras" (sin costos)', async () => {
  const p = await productoConStock(admin, 5);
  const cliente = await sesionDe('cliente');
  const venta = await vendedor.navegador.post('/api/ventas', { clave_idempotencia: randomUUID(), id_cliente: cliente.cuenta.idCliente, items: [{ id_producto: p, cantidad: 2 }] });
  assert.equal(venta.status, 201);
  const compras = await cliente.navegador.get('/api/mis-compras');
  assert.deepEqual(compras.body.map((c) => c.id_venta), [venta.body.id_venta]);
  const detalle = await cliente.navegador.get(`/api/mis-compras/${venta.body.id_venta}`);
  assert.equal(detalle.status, 200);
  assert.ok(!JSON.stringify(detalle.body).includes('costo'));
});

test('Abastecimiento: crear -> proveedor acepta -> recibir genera entradas; no se recibe si pasa de 67', async () => {
  const { navegador: proveedor } = await activarCuentaDelSeed('ventas@brillospacifico.example.com'); // proveedor 1
  const [productosP1] = await pool.query('SELECT id_producto, stock FROM productos WHERE id_proveedor = 1 ORDER BY id_producto LIMIT 1');
  const prod = productosP1[0];

  // Solo se pueden pedir productos de ese proveedor.
  const ajeno = await admin.post('/api/abastecimiento', { id_proveedor: 1, items: [{ id_producto: 1, cantidad: 2 }] }); // producto 1 es del proveedor 2
  assert.equal(ajeno.status, 400);

  const creada = await admin.post('/api/abastecimiento', { id_proveedor: 1, nota: 'Prueba', items: [{ id_producto: prod.id_producto, cantidad: 3 }] });
  assert.equal(creada.status, 201, JSON.stringify(creada.body));
  const id = creada.body.id_solicitud;
  assert.equal((await admin.patch(`/api/abastecimiento/${id}/recibir`)).status, 409, 'no se recibe si el proveedor no aceptó');
  assert.equal((await proveedor.patch(`/api/portal-proveedor/solicitudes/${id}/respuesta`, { decision: 'rechazada' })).status, 400, 'rechazar exige comentario');
  const acepta = await proveedor.patch(`/api/portal-proveedor/solicitudes/${id}/respuesta`, { decision: 'aceptada', comentario: 'Lo enviamos el lunes' });
  assert.equal(acepta.status, 200);
  assert.equal((await proveedor.patch(`/api/portal-proveedor/solicitudes/${id}/respuesta`, { decision: 'rechazada', comentario: 'x' })).status, 409);
  const recibida = await admin.patch(`/api/abastecimiento/${id}/recibir`);
  assert.equal(recibida.status, 200, JSON.stringify(recibida.body));
  assert.equal(recibida.body.estado, 'recibida');
  assert.equal(await stockDe(prod.id_producto), prod.stock + 3);
  const [movs] = await pool.execute('SELECT tipo, cantidad FROM movimientos WHERE id_solicitud = ?', [id]);
  assert.deepEqual(movs.map((m) => [m.tipo, m.cantidad]), [['entrada', 3]]);

  // Una que pasaría de 67: se rechaza entera.
  const actual = await stockDe(prod.id_producto);
  const grande = await admin.post('/api/abastecimiento', { id_proveedor: 1, items: [{ id_producto: prod.id_producto, cantidad: 67 - actual + 1 }] });
  await proveedor.patch(`/api/portal-proveedor/solicitudes/${grande.body.id_solicitud}/respuesta`, { decision: 'aceptada' });
  const excede = await admin.patch(`/api/abastecimiento/${grande.body.id_solicitud}/recibir`);
  assert.equal(excede.status, 409);
  assert.match(excede.body.message, /67/);
  assert.equal(await stockDe(prod.id_producto), actual);
  assert.equal((await admin.patch(`/api/abastecimiento/${grande.body.id_solicitud}/cancelar`)).status, 200);
});

test('Reporte ejecutivo: ganancias solo con costos reales y aviso de los que faltan', async () => {
  const { navegador: duena } = await sesionDe('duena');
  const r = await duena.get('/api/reportes/ejecutivo?desde=2026-10-01&hasta=2026-12-31');
  assert.equal(r.status, 200);
  assert.ok(r.body.resumen.ventas > 0);
  assert.ok(r.body.inventario.productos_sin_costo.length > 0, 'los productos de prueba no tienen costo');
  assert.equal(r.body.ganancia_parcial, true);
  // Comprobación independiente de la ganancia con SQL.
  const [[esperado]] = await pool.query(
    `SELECT COALESCE(SUM((dv.cantidad - COALESCE((SELECT SUM(dd.cantidad) FROM detalle_devoluciones dd WHERE dd.id_detalle_venta = dv.id_detalle_venta), 0)) * (dv.precio_unitario - dv.costo_unitario)), 0) AS ganancia
       FROM detalle_ventas dv JOIN ventas v ON v.id_venta = dv.id_venta
      WHERE dv.costo_unitario IS NOT NULL AND v.fecha BETWEEN '2026-10-01 00:00:00' AND '2026-12-31 23:59:59'`
  );
  assert.equal(r.body.resumen.ganancia, Number(esperado.ganancia));
  assert.equal((await duena.get('/api/reportes/ejecutivo?desde=2026-12-01&hasta=2026-01-01')).status, 400);
});
