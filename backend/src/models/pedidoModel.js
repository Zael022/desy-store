// Modelo de pedidos de clientes (tablas pedidos y detalle_pedidos).
//
// Ciclo de un pedido:
//   pendiente  --(la tienda confirma)-->  confirmado  --(se entrega y cobra)-->  entregado (= una venta)
//       |                                     |
//       +--> rechazado / cancelado / vencido  +--> rechazado / cancelado / vencido
//
// Reglas:
//   * Mientras está pendiente o confirmado (y sin vencer), sus unidades quedan
//     APARTADAS (ver apartados.js): no se pueden vender a otra persona. El stock no cambia.
//   * Todo cambio de estado se hace en una transacción y con la fila del pedido
//     bloqueada (FOR UPDATE): dos personas no pueden confirmar y rechazar a la vez.
//   * Al entregarlo se registra una venta normal con registrarVenta(): la salida de
//     inventario es la de siempre y se cobra el precio que tenía el pedido.
//   * Idempotencia: cada pedido trae una clave única desde el navegador (como en las ventas),
//     así un doble clic no aparta las unidades dos veces.
import crypto from 'node:crypto';
import pool, { enTransaccion } from '../config/db.js';
import { ErrorHttp } from '../middleware/errores.js';
import { bloquearProducto } from './movimientoModel.js';
import { unidadesApartadas, CONDICION_PEDIDO_ACTIVO } from './apartados.js';
import { registrarVenta } from './ventaModel.js';
import { registrarAuditoria } from '../servicios/auditoria.js';
import * as configuracionModel from './configuracionModel.js';

export const ESTADOS = ['pendiente', 'confirmado', 'entregado', 'rechazado', 'cancelado', 'vencido'];
export const MAXIMO_PEDIDOS_ACTIVOS = 3; // por cliente, para que nadie aparte todo el inventario
export const MAXIMO_UNIDADES_POR_PRODUCTO = 10;
export const MAXIMO_LINEAS = 20;

const dinero = (valor) => Math.round(valor * 100) / 100;

const SELECT_PEDIDOS = `
  SELECT pe.id_pedido, pe.id_cliente, c.nombre AS nombre_cliente, u.correo AS correo_cliente, u.telefono AS telefono_cliente,
         pe.estado, pe.total, pe.nota_cliente, pe.motivo, pe.creado_en, pe.vence_en, pe.confirmado_en, pe.cerrado_en,
         pe.id_venta, pe.id_usuario_atendio, e.nombre AS nombre_atendio,
         (pe.estado IN ('pendiente', 'confirmado') AND pe.vence_en > NOW()) AS activo,
         (SELECT COALESCE(SUM(dp.cantidad), 0) FROM detalle_pedidos dp WHERE dp.id_pedido = pe.id_pedido) AS unidades
    FROM pedidos pe
    JOIN clientes c ON c.id_cliente = pe.id_cliente
    JOIN usuarios u ON u.id_usuario = c.id_usuario
    LEFT JOIN usuarios ua ON ua.id_usuario = pe.id_usuario_atendio
    LEFT JOIN empleados e ON e.id_empleado = ua.id_empleado`;

const aPedido = (fila) => ({ ...fila, activo: Boolean(fila.activo), total: Number(fila.total), unidades: Number(fila.unidades) });

// filtros: { idCliente, estados: ['pendiente', ...] }
export async function listar({ idCliente = null, estados = null } = {}) {
  const condiciones = [];
  const valores = [];
  if (idCliente) { condiciones.push('pe.id_cliente = ?'); valores.push(idCliente); }
  if (estados?.length) { condiciones.push(`pe.estado IN (${estados.map(() => '?').join(', ')})`); valores.push(...estados); }
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await pool.execute(`${SELECT_PEDIDOS} ${donde} ORDER BY pe.creado_en DESC, pe.id_pedido DESC LIMIT 300`, valores);
  // El detalle de todos los pedidos en una sola consulta (no una por pedido).
  const detalles = await detallesDe(pool, filas.map((f) => f.id_pedido));
  return filas.map((f) => ({ ...aPedido(f), detalle: detalles.get(f.id_pedido) ?? [] }));
}

// Mapa id_pedido -> líneas del pedido (con la foto principal de cada producto).
async function detallesDe(conexion, ids) {
  const mapa = new Map();
  if (ids.length === 0) return mapa;
  const [filas] = await conexion.query(
    `SELECT dp.id_pedido, dp.id_detalle_pedido, dp.id_producto, p.codigo, p.nombre AS nombre_producto, dp.cantidad, dp.precio_unitario, dp.subtotal,
            (SELECT f.archivo FROM producto_fotos f WHERE f.id_producto = p.id_producto AND f.es_de_medidas = 0 ORDER BY f.orden, f.id_foto LIMIT 1) AS foto_principal
       FROM detalle_pedidos dp JOIN productos p ON p.id_producto = dp.id_producto
      WHERE dp.id_pedido IN (?) ORDER BY dp.id_detalle_pedido`,
    [ids]
  );
  for (const { id_pedido: id, ...linea } of filas) {
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id).push({ ...linea, precio_unitario: Number(linea.precio_unitario), subtotal: Number(linea.subtotal) });
  }
  return mapa;
}

export async function obtener(idPedido, conexion = pool) {
  const [filas] = await conexion.execute(`${SELECT_PEDIDOS} WHERE pe.id_pedido = ?`, [idPedido]);
  if (filas.length === 0) return null;
  const detalles = await detallesDe(conexion, [idPedido]);
  return { ...aPedido(filas[0]), detalle: detalles.get(idPedido) ?? [] };
}

// Cuántos pedidos activos tiene un cliente (para el máximo).
export async function contarActivos(conexion, idCliente) {
  const [[fila]] = await conexion.execute(`SELECT COUNT(*) AS total FROM pedidos pe WHERE pe.id_cliente = ? AND ${CONDICION_PEDIDO_ACTIVO}`, [idCliente]);
  return fila.total;
}

// ---------------------------------------------------------------------
// Crear (cliente). datos: { clave, idCliente, idUsuario, nota, items: [{ id_producto, cantidad }] }
// Devuelve { pedido, repetido }.
// ---------------------------------------------------------------------
export async function crear(datos, { ip } = {}) {
  const existente = await buscarPorClave(datos.clave);
  if (existente) return revisarRepetido(existente, datos);

  const { horas_pedido_pendiente: horas } = await configuracionModel.obtenerValores();
  try {
    const idPedido = await enTransaccion(async (conexion) => {
      // Se bloquea la fila del cliente: dos pedidos suyos al mismo tiempo se hacen uno tras otro
      // (así no pasa el máximo de pedidos activos).
      await conexion.execute('SELECT id_cliente FROM clientes WHERE id_cliente = ? FOR UPDATE', [datos.idCliente]);
      if ((await contarActivos(conexion, datos.idCliente)) >= MAXIMO_PEDIDOS_ACTIVOS) {
        throw new ErrorHttp(409, `Ya tiene ${MAXIMO_PEDIDOS_ACTIVOS} pedidos en curso. Espere a que la tienda los atienda o cancele alguno.`);
      }

      // Productos en orden de ID (evita bloqueos cruzados) y revisión de lo disponible de TODOS.
      const items = [...datos.items].sort((a, b) => a.id_producto - b.id_producto);
      const productos = new Map();
      for (const item of items) productos.set(item.id_producto, await bloquearProducto(conexion, item.id_producto));
      const faltantes = [];
      for (const item of items) {
        const producto = productos.get(item.id_producto);
        const disponible = Math.max(producto.stock - (await unidadesApartadas(conexion, item.id_producto)), 0);
        if (item.cantidad > disponible) {
          faltantes.push(disponible === 0 ? `"${producto.nombre}" ya no tiene unidades disponibles` : `de "${producto.nombre}" solo quedan ${disponible}`);
        }
      }
      if (faltantes.length > 0) throw new ErrorHttp(409, `No se pudo apartar el pedido: ${faltantes.join('; ')}. Ajuste las cantidades e intente de nuevo.`);

      const total = dinero(items.reduce((suma, item) => suma + Number(productos.get(item.id_producto).precio) * item.cantidad, 0));
      const [resultado] = await conexion.execute(
        `INSERT INTO pedidos (clave_idempotencia, id_cliente, estado, total, nota_cliente, vence_en)
         VALUES (?, ?, 'pendiente', ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
        [datos.clave, datos.idCliente, total, datos.nota ?? null, horas]
      );
      const id = resultado.insertId;
      for (const item of items) {
        const precio = Number(productos.get(item.id_producto).precio);
        await conexion.execute(
          'INSERT INTO detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
          [id, item.id_producto, item.cantidad, precio, dinero(precio * item.cantidad)]
        );
      }
      await registrarAuditoria({ idUsuario: datos.idUsuario, accion: 'pedido_creado', detalle: `Pedido #${id} por ${total}`, ip }, conexion);
      return id;
    });
    return { pedido: await obtener(idPedido), repetido: false };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('uq_pedidos_clave')) {
      return revisarRepetido(await buscarPorClave(datos.clave), datos);
    }
    throw error;
  }
}

async function buscarPorClave(clave) {
  const [filas] = await pool.execute('SELECT id_pedido, id_cliente FROM pedidos WHERE clave_idempotencia = ?', [clave]);
  return filas[0] || null;
}

async function revisarRepetido(existente, datos) {
  if (existente.id_cliente !== datos.idCliente) {
    throw new ErrorHttp(409, 'Esa clave de pedido ya fue usada. Recargue la página e intente de nuevo.');
  }
  return { pedido: await obtener(existente.id_pedido), repetido: true };
}

// ---------------------------------------------------------------------
// Cambios de estado
// ---------------------------------------------------------------------

// Bloquea el pedido y revisa que se pueda pasar al nuevo estado.
async function bloquearPedido(conexion, idPedido, { idCliente = null } = {}) {
  const [filas] = await conexion.execute(
    'SELECT id_pedido, id_cliente, estado, vence_en, vence_en <= NOW() AS vencido FROM pedidos WHERE id_pedido = ? FOR UPDATE',
    [idPedido]
  );
  const pedido = filas[0];
  if (!pedido || (idCliente && pedido.id_cliente !== idCliente)) throw new ErrorHttp(404, 'El pedido no existe.');
  return pedido;
}

const TEXTO_ESTADO = {
  entregado: 'ya se entregó',
  rechazado: 'fue rechazado',
  cancelado: 'fue cancelado',
  vencido: 'venció'
};

function exigirEstado(pedido, permitidos) {
  // Un pedido activo cuyo plazo ya pasó se trata como vencido (aunque el aviso automático no haya corrido).
  const estado = ['pendiente', 'confirmado'].includes(pedido.estado) && pedido.vencido ? 'vencido' : pedido.estado;
  if (!permitidos.includes(estado)) {
    const razon = TEXTO_ESTADO[estado] ?? (estado === 'pendiente' ? 'todavía no está confirmado' : 'ya está confirmado');
    throw new ErrorHttp(409, `El pedido #${pedido.id_pedido} ${razon}.`);
  }
}

// La tienda confirma: queda "listo para recoger" y el plazo pasa a ser el de recogida.
export async function confirmar(idPedido, { idUsuario, ip }) {
  const { dias_pedido_confirmado: dias } = await configuracionModel.obtenerValores();
  await enTransaccion(async (conexion) => {
    const pedido = await bloquearPedido(conexion, idPedido);
    exigirEstado(pedido, ['pendiente']);
    await conexion.execute(
      `UPDATE pedidos SET estado = 'confirmado', confirmado_en = NOW(), vence_en = DATE_ADD(NOW(), INTERVAL ? DAY), id_usuario_atendio = ?
        WHERE id_pedido = ?`,
      [dias, idUsuario, idPedido]
    );
    await registrarAuditoria({ idUsuario, accion: 'pedido_confirmado', detalle: `Pedido #${idPedido}`, ip }, conexion);
  });
  return obtener(idPedido);
}

// La tienda rechaza (pendiente) o cancela (confirmado que ya no se puede entregar). Pide motivo.
export async function rechazar(idPedido, { idUsuario, motivo, ip }) {
  await enTransaccion(async (conexion) => {
    const pedido = await bloquearPedido(conexion, idPedido);
    exigirEstado(pedido, ['pendiente', 'confirmado']);
    await conexion.execute(
      "UPDATE pedidos SET estado = 'rechazado', motivo = ?, cerrado_en = NOW(), id_usuario_atendio = ? WHERE id_pedido = ?",
      [motivo, idUsuario, idPedido]
    );
    await registrarAuditoria({ idUsuario, accion: 'pedido_rechazado', detalle: `Pedido #${idPedido}: ${motivo}`, ip }, conexion);
  });
  return obtener(idPedido);
}

// El cliente cancela su propio pedido (pendiente o confirmado).
export async function cancelarPorCliente(idPedido, { idCliente, idUsuario, ip }) {
  await enTransaccion(async (conexion) => {
    const pedido = await bloquearPedido(conexion, idPedido, { idCliente });
    exigirEstado(pedido, ['pendiente', 'confirmado']);
    await conexion.execute(
      "UPDATE pedidos SET estado = 'cancelado', motivo = 'Cancelado por el cliente', cerrado_en = NOW() WHERE id_pedido = ?",
      [idPedido]
    );
    await registrarAuditoria({ idUsuario, accion: 'pedido_cancelado', detalle: `Pedido #${idPedido}`, ip }, conexion);
  });
  return obtener(idPedido);
}

// Entregar y cobrar en la tienda: el pedido se vuelve una venta (con su salida de inventario).
export async function entregar(idPedido, { idUsuario, idEmpleado, ip }) {
  const idVenta = await enTransaccion(async (conexion) => {
    const pedido = await bloquearPedido(conexion, idPedido);
    exigirEstado(pedido, ['confirmado']);
    const [lineas] = await conexion.execute('SELECT id_producto, cantidad, precio_unitario FROM detalle_pedidos WHERE id_pedido = ?', [idPedido]);

    // 1. Primero se cierra el pedido: así sus unidades dejan de estar apartadas...
    await conexion.execute(
      "UPDATE pedidos SET estado = 'entregado', cerrado_en = NOW(), id_usuario_atendio = ? WHERE id_pedido = ?",
      [idUsuario, idPedido]
    );
    // 2. ...y la venta las puede sacar del stock. Se cobra el precio del pedido.
    const venta = await registrarVenta(conexion, {
      clave: crypto.randomUUID(),
      idUsuario,
      idEmpleado,
      idCliente: pedido.id_cliente,
      nota: `Pedido #${idPedido}`,
      items: lineas.map((l) => ({ id_producto: l.id_producto, cantidad: l.cantidad, precio: Number(l.precio_unitario) }))
    });
    await conexion.execute('UPDATE pedidos SET id_venta = ? WHERE id_pedido = ?', [venta.idVenta, idPedido]);
    await registrarAuditoria({ idUsuario, accion: 'pedido_entregado', detalle: `Pedido #${idPedido} -> venta #${venta.idVenta}`, ip }, conexion);
    return venta.idVenta;
  });
  return { pedido: await obtener(idPedido), idVenta };
}

// Marca como vencidos los pedidos cuyo plazo pasó. Devuelve los pedidos vencidos
// (con el correo del cliente) para avisarles.
export async function vencerAtrasados() {
  return enTransaccion(async (conexion) => {
    const [filas] = await conexion.query(
      "SELECT id_pedido, estado FROM pedidos WHERE estado IN ('pendiente', 'confirmado') AND vence_en <= NOW() FOR UPDATE"
    );
    if (filas.length === 0) return [];
    const ids = filas.map((f) => f.id_pedido);
    await conexion.query(
      `UPDATE pedidos
          SET motivo = IF(estado = 'pendiente', 'La tienda no lo confirmó a tiempo', 'No se recogió a tiempo'),
              estado = 'vencido', cerrado_en = NOW()
        WHERE id_pedido IN (?)`,
      [ids]
    );
    await registrarAuditoria({ idUsuario: null, accion: 'pedidos_vencidos', detalle: `Pedidos ${ids.map((i) => `#${i}`).join(', ')}` }, conexion);
    const vencidos = [];
    for (const id of ids) vencidos.push(await obtener(id, conexion));
    return vencidos;
  });
}
