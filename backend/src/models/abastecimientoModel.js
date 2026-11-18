// Solicitudes de abastecimiento (pedidos de la tienda a un proveedor).
//
// Estados: pendiente -> aceptada | rechazada (responde el proveedor)
//          aceptada  -> recibida (administración; genera las ENTRADAS de inventario)
//          pendiente | aceptada -> cancelada (administración)
// Al recibir, cada producto entra con registrarMovimiento(), la misma lógica de
// siempre, y todo va en una sola transacción (si un producto pasaría de 67, no entra nada).
import pool, { enTransaccion } from '../config/db.js';
import { STOCK_MAXIMO } from '../config/constantes.js';
import { ErrorHttp } from '../middleware/errores.js';
import { registrarMovimiento } from './movimientoModel.js';
import { registrarAuditoria } from '../servicios/auditoria.js';

const SELECT_SOLICITUDES = `
  SELECT s.id_solicitud, s.id_proveedor, pr.nombre AS nombre_proveedor, s.estado,
         s.nota_tienda, s.comentario_proveedor, s.creada_en, s.respondida_en, s.recibida_en,
         ec.nombre AS creada_por, er.nombre AS recibida_por,
         (SELECT COUNT(*) FROM detalle_solicitudes_abastecimiento d WHERE d.id_solicitud = s.id_solicitud) AS productos,
         (SELECT COALESCE(SUM(d.cantidad), 0) FROM detalle_solicitudes_abastecimiento d WHERE d.id_solicitud = s.id_solicitud) AS unidades
    FROM solicitudes_abastecimiento s
    JOIN proveedores pr ON pr.id_proveedor = s.id_proveedor
    JOIN usuarios uc ON uc.id_usuario = s.id_usuario_creador
    LEFT JOIN empleados ec ON ec.id_empleado = uc.id_empleado
    LEFT JOIN usuarios ur ON ur.id_usuario = s.id_usuario_recibio
    LEFT JOIN empleados er ON er.id_empleado = ur.id_empleado`;

export async function listar({ idProveedor = null, estado = null } = {}) {
  const condiciones = [];
  const valores = [];
  if (idProveedor) { condiciones.push('s.id_proveedor = ?'); valores.push(idProveedor); }
  if (estado) { condiciones.push('s.estado = ?'); valores.push(estado); }
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await pool.execute(`${SELECT_SOLICITUDES} ${donde} ORDER BY s.creada_en DESC, s.id_solicitud DESC`, valores);
  return filas;
}

// Con el detalle. "conStock" agrega el stock actual de cada producto (para el personal).
export async function obtener(idSolicitud, { conStock = false } = {}) {
  const [filas] = await pool.execute(`${SELECT_SOLICITUDES} WHERE s.id_solicitud = ?`, [idSolicitud]);
  if (filas.length === 0) return null;
  const [detalle] = await pool.execute(
    `SELECT d.id_detalle_solicitud, d.id_producto, p.codigo, p.nombre AS nombre_producto, d.cantidad${conStock ? ', p.stock AS stock_actual' : ''}
       FROM detalle_solicitudes_abastecimiento d
       JOIN productos p ON p.id_producto = d.id_producto
      WHERE d.id_solicitud = ?
      ORDER BY p.nombre`,
    [idSolicitud]
  );
  return { ...filas[0], detalle };
}

// datos: { idProveedor, idUsuario, nota, items: [{ id_producto, cantidad }] }
export async function registrarSolicitud(conexion, datos) {
  for (const item of datos.items) {
    const [productos] = await conexion.execute('SELECT nombre, id_proveedor FROM productos WHERE id_producto = ?', [item.id_producto]);
    if (productos.length === 0) throw new ErrorHttp(400, `El producto #${item.id_producto} no existe.`);
    if (productos[0].id_proveedor !== datos.idProveedor) {
      throw new ErrorHttp(400, `"${productos[0].nombre}" no es de este proveedor. Solo se pueden pedir productos que él suministra.`);
    }
  }
  const [resultado] = await conexion.execute(
    'INSERT INTO solicitudes_abastecimiento (id_proveedor, id_usuario_creador, nota_tienda) VALUES (?, ?, ?)',
    [datos.idProveedor, datos.idUsuario, datos.nota ?? null]
  );
  for (const item of datos.items) {
    await conexion.execute(
      'INSERT INTO detalle_solicitudes_abastecimiento (id_solicitud, id_producto, cantidad) VALUES (?, ?, ?)',
      [resultado.insertId, item.id_producto, item.cantidad]
    );
  }
  return resultado.insertId;
}

export async function crear(datos, { ip } = {}) {
  const id = await enTransaccion(async (conexion) => {
    const idSolicitud = await registrarSolicitud(conexion, datos);
    await registrarAuditoria({ idUsuario: datos.idUsuario, accion: 'solicitud_creada', detalle: `Solicitud #${idSolicitud} al proveedor #${datos.idProveedor}`, ip }, conexion);
    return idSolicitud;
  });
  return obtener(id, { conStock: true });
}

async function bloquearSolicitud(conexion, idSolicitud) {
  const [filas] = await conexion.execute('SELECT id_solicitud, id_proveedor, estado FROM solicitudes_abastecimiento WHERE id_solicitud = ? FOR UPDATE', [idSolicitud]);
  return filas[0] || null;
}

// El proveedor acepta o rechaza. soloProveedor viene de la sesión: si la solicitud es de otro, 404.
export async function responder({ idSolicitud, soloProveedor, decision, comentario, idUsuario, ip }) {
  await enTransaccion(async (conexion) => {
    const solicitud = await bloquearSolicitud(conexion, idSolicitud);
    if (!solicitud || solicitud.id_proveedor !== soloProveedor) throw new ErrorHttp(404, 'La solicitud no existe.');
    if (solicitud.estado !== 'pendiente') throw new ErrorHttp(409, `Esta solicitud ya está "${solicitud.estado}" y no se puede responder de nuevo.`);
    await conexion.execute(
      'UPDATE solicitudes_abastecimiento SET estado = ?, comentario_proveedor = ?, respondida_en = NOW() WHERE id_solicitud = ?',
      [decision, comentario, idSolicitud]
    );
    await registrarAuditoria({ idUsuario, accion: `solicitud_${decision}`, detalle: `Solicitud #${idSolicitud}`, ip }, conexion);
  });
  return obtener(idSolicitud);
}

// Recibir: solo si está "aceptada". Genera una entrada por producto.
export async function recibir({ idSolicitud, idUsuario, idEmpleado, ip }) {
  await enTransaccion(async (conexion) => {
    const solicitud = await bloquearSolicitud(conexion, idSolicitud);
    if (!solicitud) throw new ErrorHttp(404, 'La solicitud no existe.');
    if (solicitud.estado !== 'aceptada') {
      throw new ErrorHttp(409, `Solo se puede recibir una solicitud aceptada por el proveedor (esta está "${solicitud.estado}").`);
    }
    const [items] = await conexion.execute(
      'SELECT id_producto, cantidad FROM detalle_solicitudes_abastecimiento WHERE id_solicitud = ? ORDER BY id_producto',
      [idSolicitud]
    );
    const [[{ hoy }]] = await conexion.query("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d') AS hoy");
    for (const item of items) {
      await registrarMovimiento(
        conexion,
        {
          id_producto: item.id_producto,
          id_empleado: idEmpleado,
          tipo: 'entrada',
          cantidad: item.cantidad,
          fecha: hoy,
          motivo: `Abastecimiento: solicitud #${idSolicitud}`,
          id_solicitud: idSolicitud
        },
        {
          exceso: (producto) =>
            `No se puede recibir la solicitud: "${producto.nombre}" tiene ${producto.stock} unidades y con ${item.cantidad} más pasaría el máximo de ${STOCK_MAXIMO}. No se registró ninguna entrada.`
        }
      );
    }
    await conexion.execute(
      "UPDATE solicitudes_abastecimiento SET estado = 'recibida', id_usuario_recibio = ?, recibida_en = NOW() WHERE id_solicitud = ?",
      [idUsuario, idSolicitud]
    );
    await registrarAuditoria({ idUsuario, accion: 'solicitud_recibida', detalle: `Solicitud #${idSolicitud}: ${items.length} entrada(s) de inventario`, ip }, conexion);
  });
  return obtener(idSolicitud, { conStock: true });
}

export async function cancelar({ idSolicitud, idUsuario, ip }) {
  await enTransaccion(async (conexion) => {
    const solicitud = await bloquearSolicitud(conexion, idSolicitud);
    if (!solicitud) throw new ErrorHttp(404, 'La solicitud no existe.');
    if (!['pendiente', 'aceptada'].includes(solicitud.estado)) {
      throw new ErrorHttp(409, `Una solicitud "${solicitud.estado}" ya no se puede cancelar.`);
    }
    await conexion.execute("UPDATE solicitudes_abastecimiento SET estado = 'cancelada' WHERE id_solicitud = ?", [idSolicitud]);
    await registrarAuditoria({ idUsuario, accion: 'solicitud_cancelada', detalle: `Solicitud #${idSolicitud}`, ip }, conexion);
  });
  return obtener(idSolicitud, { conStock: true });
}

export async function contarPorProveedor(idProveedor) {
  const [filas] = await pool.execute('SELECT COUNT(*) AS total FROM solicitudes_abastecimiento WHERE id_proveedor = ?', [idProveedor]);
  return filas[0].total;
}
