// Modelo de ventas y devoluciones.
//
// Reglas (ver también el README):
//   * Una venta se confirma en UNA transacción: se bloquean las filas de los
//     productos (FOR UPDATE), se revisa el stock, se guarda la venta y su detalle
//     y se registra UNA salida por producto con registrarMovimiento() (la misma
//     lógica de inventario de siempre). Si algo falla, no queda nada guardado.
//   * Idempotencia: cada venta trae una "clave" única generada por el navegador.
//     Analogía: es el número de un ticket de fila. Si por un doble clic o un
//     corte de internet llega dos veces el mismo ticket, se atiende una sola vez.
//   * Una venta confirmada no se edita ni se borra: se corrige con una devolución.
//   * Una devolución vuelve a meter las unidades con una entrada (también con
//     registrarMovimiento). No se puede devolver más de lo vendido menos lo ya
//     devuelto, ni pasar el máximo de 67 unidades.
import pool, { enTransaccion } from '../config/db.js';
import { STOCK_MAXIMO } from '../config/constantes.js';
import { ErrorHttp } from '../middleware/errores.js';
import { bloquearProducto, registrarMovimiento } from './movimientoModel.js';
import { unidadesApartadas } from './apartados.js';
import { registrarAuditoria } from '../servicios/auditoria.js';

const dinero = (valor) => Math.round(valor * 100) / 100;

// ---------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------

const SELECT_VENTAS = `
  SELECT v.id_venta, v.fecha, v.total, v.nota, v.id_usuario, v.id_empleado, e.nombre AS nombre_vendedor,
         v.id_cliente, c.nombre AS nombre_cliente,
         (SELECT COALESCE(SUM(dv.cantidad), 0) FROM detalle_ventas dv WHERE dv.id_venta = v.id_venta) AS unidades,
         (SELECT COALESCE(SUM(d.total), 0) FROM devoluciones d WHERE d.id_venta = v.id_venta) AS total_devuelto
    FROM ventas v
    JOIN empleados e ON e.id_empleado = v.id_empleado
    LEFT JOIN clientes c ON c.id_cliente = v.id_cliente`;

// filtros: { idUsuario (solo las de esa cuenta), idCliente, desde, hasta }
export async function listar({ idUsuario = null, idCliente = null, desde = null, hasta = null } = {}) {
  const condiciones = [];
  const valores = [];
  if (idUsuario) { condiciones.push('v.id_usuario = ?'); valores.push(idUsuario); }
  if (idCliente) { condiciones.push('v.id_cliente = ?'); valores.push(idCliente); }
  if (desde) { condiciones.push('v.fecha >= ?'); valores.push(`${desde} 00:00:00`); }
  if (hasta) { condiciones.push('v.fecha <= ?'); valores.push(`${hasta} 23:59:59`); }
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await pool.execute(`${SELECT_VENTAS} ${donde} ORDER BY v.fecha DESC, v.id_venta DESC LIMIT 500`, valores);
  return filas;
}

// Venta con su detalle; cada línea trae cuánto se devolvió ya.
export async function obtener(idVenta, conexion = pool) {
  const [ventas] = await conexion.execute(`${SELECT_VENTAS} WHERE v.id_venta = ?`, [idVenta]);
  if (ventas.length === 0) return null;
  const [detalle] = await conexion.execute(
    `SELECT dv.id_detalle_venta, dv.id_producto, p.codigo, p.nombre AS nombre_producto,
            dv.cantidad, dv.precio_unitario, dv.costo_unitario, dv.subtotal,
            COALESCE((SELECT SUM(dd.cantidad) FROM detalle_devoluciones dd WHERE dd.id_detalle_venta = dv.id_detalle_venta), 0) AS cantidad_devuelta
       FROM detalle_ventas dv
       JOIN productos p ON p.id_producto = dv.id_producto
      WHERE dv.id_venta = ?
      ORDER BY dv.id_detalle_venta`,
    [idVenta]
  );
  const [devoluciones] = await conexion.execute(
    `SELECT d.id_devolucion, d.fecha, d.motivo, d.total, e.nombre AS nombre_empleado
       FROM devoluciones d JOIN empleados e ON e.id_empleado = d.id_empleado
      WHERE d.id_venta = ? ORDER BY d.id_devolucion`,
    [idVenta]
  );
  return { ...ventas[0], detalle, devoluciones };
}

export async function buscarPorClave(clave) {
  const [filas] = await pool.execute('SELECT id_venta, id_usuario FROM ventas WHERE clave_idempotencia = ?', [clave]);
  return filas[0] || null;
}

// ---------------------------------------------------------------------
// Registrar una venta (dentro de una transacción ya abierta)
//   datos: { clave, idUsuario, idEmpleado, idCliente, nota, items: [{ id_producto, cantidad, precio? }], fecha? }
//   "fecha" (AAAA-MM-DD HH:MM:SS) solo la usa el seed para datos de ejemplo.
//   "precio" (opcional) lo usa la entrega de un pedido: se cobra el precio que se le prometió al cliente.
//   Las unidades apartadas en pedidos de otros clientes NO se pueden vender.
// ---------------------------------------------------------------------
export async function registrarVenta(conexion, datos) {
  // 1. Bloquear los productos en orden de ID (evita bloqueos cruzados entre dos ventas).
  const items = [...datos.items].sort((a, b) => a.id_producto - b.id_producto);
  const productos = new Map();
  for (const item of items) {
    productos.set(item.id_producto, await bloquearProducto(conexion, item.id_producto));
  }

  // 2. Revisar lo disponible de TODOS antes de guardar nada (stock menos lo apartado en pedidos).
  for (const item of items) {
    const producto = productos.get(item.id_producto);
    const apartado = await unidadesApartadas(conexion, item.id_producto);
    const disponible = Math.max(producto.stock - apartado, 0);
    if (item.cantidad > disponible) {
      const detalleApartado = apartado > 0 ? ` (${apartado} están apartadas en pedidos de clientes)` : '';
      throw new ErrorHttp(
        409,
        disponible === 0
          ? `No hay unidades disponibles de "${producto.nombre}"${detalleApartado}. Quítelo de la venta.`
          : `No hay suficiente stock de "${producto.nombre}": hay ${disponible} disponibles${detalleApartado} y la venta pide ${item.cantidad}.`
      );
    }
  }
  const precioDe = (item) => item.precio ?? productos.get(item.id_producto).precio;

  // 3. Guardar la venta. Precio y costo se copian tal como están HOY:
  //    si mañana cambia el precio, esta venta conserva el precio con que se vendió.
  const total = dinero(items.reduce((suma, item) => suma + precioDe(item) * item.cantidad, 0));
  const [resultado] = await conexion.execute(
    `INSERT INTO ventas (clave_idempotencia, id_usuario, id_empleado, id_cliente, total, nota, fecha)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))`,
    [datos.clave, datos.idUsuario, datos.idEmpleado, datos.idCliente ?? null, total, datos.nota ?? null, datos.fecha ?? null]
  );
  const idVenta = resultado.insertId;
  const [[{ dia }]] = await conexion.execute("SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS dia FROM ventas WHERE id_venta = ?", [idVenta]);

  // 4. Detalle + una salida de inventario por producto, enlazada a la venta.
  for (const item of items) {
    const producto = productos.get(item.id_producto);
    await conexion.execute(
      `INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario, costo_unitario, subtotal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idVenta, item.id_producto, item.cantidad, precioDe(item), producto.costo_unitario, dinero(precioDe(item) * item.cantidad)]
    );
    await registrarMovimiento(conexion, {
      id_producto: item.id_producto,
      id_empleado: datos.idEmpleado,
      tipo: 'salida',
      cantidad: item.cantidad,
      fecha: dia,
      motivo: `Venta #${idVenta}`,
      id_venta: idVenta
    });
  }
  return { idVenta, total };
}

// Confirma una venta desde el punto de venta.
// Devuelve { venta, repetida } (repetida = true si la clave ya se había usado).
export async function crearVenta(datos, { ip } = {}) {
  const existente = await buscarPorClave(datos.clave);
  if (existente) return revisarRepetida(existente, datos);

  try {
    const { idVenta } = await enTransaccion(async (conexion) => {
      const resultado = await registrarVenta(conexion, datos);
      await registrarAuditoria({
        idUsuario: datos.idUsuario,
        accion: 'venta_registrada',
        detalle: `Venta #${resultado.idVenta} por ${resultado.total}`,
        ip
      }, conexion);
      return resultado;
    });
    return { venta: await obtener(idVenta), repetida: false };
  } catch (error) {
    // Dos peticiones con la misma clave al mismo tiempo: la segunda choca con el UNIQUE.
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('uq_ventas_clave')) {
      return revisarRepetida(await buscarPorClave(datos.clave), datos);
    }
    throw error;
  }
}

async function revisarRepetida(existente, datos) {
  if (existente.id_usuario !== datos.idUsuario) {
    throw new ErrorHttp(409, 'Esa clave de venta ya fue usada. Recargue el punto de venta e intente de nuevo.');
  }
  return { venta: await obtener(existente.id_venta), repetida: true };
}

// ---------------------------------------------------------------------
// Devoluciones
// ---------------------------------------------------------------------

// datos: { idVenta, idUsuario, idEmpleado, motivo, items: [{ id_detalle_venta, cantidad }],
//          soloDeUsuario (si viene, la venta debe ser de esa cuenta), fecha? (solo seed) }
export async function registrarDevolucion(conexion, datos) {
  // Bloquear la venta: dos devoluciones de la misma venta se hacen una después de la otra.
  const [ventas] = await conexion.execute('SELECT id_venta, id_usuario FROM ventas WHERE id_venta = ? FOR UPDATE', [datos.idVenta]);
  if (ventas.length === 0 || (datos.soloDeUsuario && ventas[0].id_usuario !== datos.soloDeUsuario)) {
    throw new ErrorHttp(404, 'La venta no existe.');
  }

  const [lineas] = await conexion.execute(
    `SELECT dv.id_detalle_venta, dv.id_producto, dv.cantidad, dv.precio_unitario, p.nombre,
            COALESCE((SELECT SUM(dd.cantidad) FROM detalle_devoluciones dd WHERE dd.id_detalle_venta = dv.id_detalle_venta), 0) AS devuelta
       FROM detalle_ventas dv JOIN productos p ON p.id_producto = dv.id_producto
      WHERE dv.id_venta = ?`,
    [datos.idVenta]
  );
  const porId = new Map(lineas.map((l) => [l.id_detalle_venta, l]));

  let total = 0;
  for (const item of datos.items) {
    const linea = porId.get(item.id_detalle_venta);
    if (!linea) throw new ErrorHttp(400, `El producto #${item.id_detalle_venta} no pertenece a la venta #${datos.idVenta}.`);
    const disponible = linea.cantidad - linea.devuelta;
    if (item.cantidad > disponible) {
      throw new ErrorHttp(
        409,
        disponible === 0
          ? `"${linea.nombre}" ya se devolvió completo en esta venta.`
          : `Solo puede devolver ${disponible} unidad(es) de "${linea.nombre}": se vendieron ${linea.cantidad} y ya se devolvieron ${linea.devuelta}.`
      );
    }
    total += linea.precio_unitario * item.cantidad;
  }
  total = dinero(total);

  const [resultado] = await conexion.execute(
    'INSERT INTO devoluciones (id_venta, id_usuario, id_empleado, motivo, total, fecha) VALUES (?, ?, ?, ?, ?, COALESCE(?, NOW()))',
    [datos.idVenta, datos.idUsuario, datos.idEmpleado, datos.motivo, total, datos.fecha ?? null]
  );
  const idDevolucion = resultado.insertId;
  const [[{ dia }]] = await conexion.execute("SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS dia FROM devoluciones WHERE id_devolucion = ?", [idDevolucion]);

  // Orden por producto para bloquear siempre en el mismo orden.
  const ordenados = [...datos.items].sort((a, b) => porId.get(a.id_detalle_venta).id_producto - porId.get(b.id_detalle_venta).id_producto);
  for (const item of ordenados) {
    const linea = porId.get(item.id_detalle_venta);
    await conexion.execute(
      'INSERT INTO detalle_devoluciones (id_devolucion, id_detalle_venta, cantidad, monto) VALUES (?, ?, ?, ?)',
      [idDevolucion, item.id_detalle_venta, item.cantidad, dinero(linea.precio_unitario * item.cantidad)]
    );
    await registrarMovimiento(
      conexion,
      {
        id_producto: linea.id_producto,
        id_empleado: datos.idEmpleado,
        tipo: 'entrada',
        cantidad: item.cantidad,
        fecha: dia,
        motivo: `Devolución #${idDevolucion} de la venta #${datos.idVenta}`,
        id_devolucion: idDevolucion
      },
      {
        exceso: (producto) =>
          `No se puede recibir la devolución: "${producto.nombre}" tiene ${producto.stock} unidades y con ${item.cantidad} más pasaría el máximo de ${STOCK_MAXIMO}. Registre primero una salida o reduzca la cantidad.`
      }
    );
  }
  return { idDevolucion, total };
}

export async function crearDevolucion(datos, { ip } = {}) {
  const { idDevolucion } = await enTransaccion(async (conexion) => {
    const resultado = await registrarDevolucion(conexion, datos);
    await registrarAuditoria({
      idUsuario: datos.idUsuario,
      accion: 'devolucion_registrada',
      detalle: `Devolución #${resultado.idDevolucion} de la venta #${datos.idVenta} por ${resultado.total}. Motivo: ${datos.motivo}`,
      ip
    }, conexion);
    return resultado;
  });
  return obtenerDevolucion(idDevolucion);
}

const SELECT_DEVOLUCIONES = `
  SELECT d.id_devolucion, d.id_venta, d.fecha, d.motivo, d.total, d.id_usuario,
         e.nombre AS nombre_empleado, v.id_usuario AS id_usuario_venta,
         (SELECT COALESCE(SUM(dd.cantidad), 0) FROM detalle_devoluciones dd WHERE dd.id_devolucion = d.id_devolucion) AS unidades
    FROM devoluciones d
    JOIN ventas v ON v.id_venta = d.id_venta
    JOIN empleados e ON e.id_empleado = d.id_empleado`;

export async function obtenerDevolucion(idDevolucion) {
  const [filas] = await pool.execute(`${SELECT_DEVOLUCIONES} WHERE d.id_devolucion = ?`, [idDevolucion]);
  if (filas.length === 0) return null;
  const [detalle] = await pool.execute(
    `SELECT dd.id_detalle_devolucion, dd.id_detalle_venta, p.codigo, p.nombre AS nombre_producto, dd.cantidad, dd.monto
       FROM detalle_devoluciones dd
       JOIN detalle_ventas dv ON dv.id_detalle_venta = dd.id_detalle_venta
       JOIN productos p ON p.id_producto = dv.id_producto
      WHERE dd.id_devolucion = ?`,
    [idDevolucion]
  );
  return { ...filas[0], detalle };
}

// soloDeVentasDe: si viene, solo devoluciones de ventas hechas por esa cuenta.
export async function listarDevoluciones({ soloDeVentasDe = null } = {}) {
  const donde = soloDeVentasDe ? 'WHERE v.id_usuario = ?' : '';
  const [filas] = await pool.execute(`${SELECT_DEVOLUCIONES} ${donde} ORDER BY d.fecha DESC, d.id_devolucion DESC LIMIT 500`, soloDeVentasDe ? [soloDeVentasDe] : []);
  return filas;
}
