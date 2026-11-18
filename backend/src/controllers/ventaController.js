// Punto de venta, ventas, devoluciones e historial de compras del cliente.
// El vendedor, su empleado y su rol salen SIEMPRE de la sesión (req.usuario).
import pool from '../config/db.js';
import { STOCK_MAXIMO } from '../config/constantes.js';
import * as ventaModel from '../models/ventaModel.js';
import * as usuarioModel from '../models/usuarioModel.js';
import * as configuracionModel from '../models/configuracionModel.js';
import { sqlApartado } from '../models/apartados.js';
import { ErrorHttp } from '../middleware/errores.js';
import { obtenerCuerpo, validarId, textoObligatorio, textoOpcional, enteroEnRango, validarFecha } from '../middleware/validaciones.js';
import { ipDe } from '../servicios/auditoria.js';

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAXIMO_LINEAS = 50;

// El costo es información de la dueña: se quita para los demás roles.
function sinCostos(venta, rol) {
  if (!venta || rol === 'duena') return venta;
  return { ...venta, detalle: venta.detalle.map(({ costo_unitario: _costo, ...linea }) => linea) };
}

// Rol "ventas" solo ve lo suyo; administración y dueña ven todo.
const soloPropias = (usuario) => (usuario.rol === 'ventas' ? usuario.id_usuario : null);

function validarRangoFechas(query) {
  const desde = query.desde ? validarFecha(query.desde, 'La fecha "desde"') : null;
  const hasta = query.hasta ? validarFecha(query.hasta, 'La fecha "hasta"') : null;
  if (desde && hasta && desde > hasta) throw new ErrorHttp(400, 'La fecha "desde" no puede ser posterior a "hasta".');
  return { desde, hasta };
}

// ---------------------------------------------------------------------
// GET /api/punto-venta/productos?buscar=texto
// ---------------------------------------------------------------------
export async function buscarProductosPos(req, res, next) {
  try {
    const texto = typeof req.query.buscar === 'string' ? req.query.buscar.trim().slice(0, 60) : '';
    const patron = `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const [filas] = await pool.execute(
      // "stock" = lo que se puede vender: stock físico menos lo apartado en pedidos de clientes.
      `SELECT p.id_producto, p.codigo, p.nombre, p.precio, GREATEST(p.stock - ${sqlApartado('p')}, 0) AS stock,
              p.stock AS stock_fisico, ${sqlApartado('p')} AS apartado, c.nombre AS nombre_categoria
         FROM productos p JOIN categorias c ON c.id_categoria = p.id_categoria
        WHERE p.nombre LIKE ? OR p.codigo LIKE ?
        ORDER BY p.nombre
        LIMIT 60`,
      [patron, patron]
    );
    const { umbral_pocas_unidades: umbral } = await configuracionModel.obtenerValores();
    res.status(200).json(filas.map((p) => ({ ...p, disponibilidad: configuracionModel.disponibilidad(p.stock, umbral) })));
  } catch (error) {
    next(error);
  }
}

// GET /api/punto-venta/clientes?buscar=texto (mínimo 2 letras)
export async function buscarClientesPos(req, res, next) {
  try {
    const texto = typeof req.query.buscar === 'string' ? req.query.buscar.trim().slice(0, 60) : '';
    if (texto.length < 2) return res.status(200).json([]);
    res.status(200).json(await usuarioModel.buscarClientes(texto));
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/ventas
// { clave_idempotencia, id_cliente?, nota?, items: [{ id_producto, cantidad }] }
// ---------------------------------------------------------------------
export async function crearVenta(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    if (typeof cuerpo.clave_idempotencia !== 'string' || !PATRON_UUID.test(cuerpo.clave_idempotencia)) {
      throw new ErrorHttp(400, 'Falta la clave de la venta (clave_idempotencia) o no es válida. Recargue el punto de venta.');
    }
    if (!Array.isArray(cuerpo.items) || cuerpo.items.length === 0) {
      throw new ErrorHttp(400, 'Agregue al menos un producto a la venta.');
    }
    if (cuerpo.items.length > MAXIMO_LINEAS) throw new ErrorHttp(400, `Una venta puede tener como máximo ${MAXIMO_LINEAS} productos distintos.`);

    const vistos = new Set();
    const items = cuerpo.items.map((item, posicion) => {
      if (item === null || typeof item !== 'object') throw new ErrorHttp(400, `El producto en la posición ${posicion + 1} no es válido.`);
      const idProducto = validarId(item.id_producto, `El producto en la posición ${posicion + 1} no es válido.`);
      if (vistos.has(idProducto)) throw new ErrorHttp(400, 'Un producto aparece dos veces en la venta: sume las cantidades en una sola línea.');
      vistos.add(idProducto);
      return { id_producto: idProducto, cantidad: enteroEnRango(item.cantidad, 'La cantidad', 1, STOCK_MAXIMO) };
    });

    let idCliente = null;
    if (cuerpo.id_cliente !== undefined && cuerpo.id_cliente !== null && cuerpo.id_cliente !== '') {
      idCliente = validarId(cuerpo.id_cliente, 'El cliente seleccionado no es válido.');
      if (!(await usuarioModel.existeCliente(idCliente))) throw new ErrorHttp(400, 'El cliente seleccionado no existe o su cuenta está desactivada.');
    }

    const { venta, repetida } = await ventaModel.crearVenta(
      {
        clave: cuerpo.clave_idempotencia.toLowerCase(),
        idUsuario: req.usuario.id_usuario,
        idEmpleado: req.usuario.id_empleado,
        idCliente,
        nota: textoOpcional(cuerpo.nota, 'La nota', 255),
        items
      },
      { ip: ipDe(req) }
    );
    // 201 = venta nueva. 200 = la misma venta ya estaba registrada (no se cobra dos veces).
    res.status(repetida ? 200 : 201).json({
      ...sinCostos(venta, req.usuario.rol),
      repetida,
      message: repetida ? `La venta #${venta.id_venta} ya estaba registrada; no se duplicó.` : `Venta #${venta.id_venta} registrada.`
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/ventas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
export async function listarVentas(req, res, next) {
  try {
    const { desde, hasta } = validarRangoFechas(req.query);
    res.status(200).json(await ventaModel.listar({ idUsuario: soloPropias(req.usuario), desde, hasta }));
  } catch (error) {
    next(error);
  }
}

// GET /api/ventas/:id
export async function obtenerVenta(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const venta = await ventaModel.obtener(id);
    const propia = soloPropias(req.usuario);
    // Una venta ajena se responde como inexistente (404): no se confirma que exista.
    if (!venta || (propia && venta.id_usuario !== propia)) throw new ErrorHttp(404, 'La venta no existe.');
    res.status(200).json(sinCostos(venta, req.usuario.rol));
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/devoluciones   { id_venta, motivo, items: [{ id_detalle_venta, cantidad }] }
// ---------------------------------------------------------------------
export async function crearDevolucion(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const idVenta = validarId(cuerpo.id_venta, 'Seleccione una venta válida.');
    const motivo = textoObligatorio(cuerpo.motivo, 'El motivo de la devolución', 255);
    if (!Array.isArray(cuerpo.items) || cuerpo.items.length === 0) {
      throw new ErrorHttp(400, 'Indique qué productos y cuántas unidades se devuelven.');
    }
    const vistos = new Set();
    const items = cuerpo.items.map((item) => {
      if (item === null || typeof item !== 'object') throw new ErrorHttp(400, 'Una línea de la devolución no es válida.');
      const idDetalle = validarId(item.id_detalle_venta, 'Una línea de la devolución no es válida.');
      if (vistos.has(idDetalle)) throw new ErrorHttp(400, 'Un producto aparece dos veces en la devolución.');
      vistos.add(idDetalle);
      return { id_detalle_venta: idDetalle, cantidad: enteroEnRango(item.cantidad, 'La cantidad a devolver', 1, STOCK_MAXIMO) };
    });

    const devolucion = await ventaModel.crearDevolucion(
      {
        idVenta,
        idUsuario: req.usuario.id_usuario,
        idEmpleado: req.usuario.id_empleado,
        motivo,
        items,
        soloDeUsuario: soloPropias(req.usuario)
      },
      { ip: ipDe(req) }
    );
    res.status(201).json({ ...devolucion, message: `Devolución #${devolucion.id_devolucion} registrada. Las unidades volvieron al inventario.` });
  } catch (error) {
    next(error);
  }
}

// GET /api/devoluciones
export async function listarDevoluciones(req, res, next) {
  try {
    res.status(200).json(await ventaModel.listarDevoluciones({ soloDeVentasDe: soloPropias(req.usuario) }));
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// Cliente: GET /api/mis-compras  y  GET /api/mis-compras/:id
// El cliente sale de la sesión: no hay forma de pedir el historial de otro.
// ---------------------------------------------------------------------
function compraParaCliente(venta) {
  return {
    id_venta: venta.id_venta,
    fecha: venta.fecha,
    total: venta.total,
    total_devuelto: venta.total_devuelto,
    unidades: venta.unidades,
    nombre_vendedor: venta.nombre_vendedor,
    ...(venta.detalle
      ? {
          detalle: venta.detalle.map((l) => ({
            id_detalle_venta: l.id_detalle_venta,
            id_producto: l.id_producto,
            codigo: l.codigo,
            nombre_producto: l.nombre_producto,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            subtotal: l.subtotal,
            cantidad_devuelta: l.cantidad_devuelta
          })),
          devoluciones: venta.devoluciones.map((d) => ({ id_devolucion: d.id_devolucion, fecha: d.fecha, motivo: d.motivo, total: d.total }))
        }
      : {})
  };
}

export async function listarMisCompras(req, res, next) {
  try {
    // Defensa extra: sin cliente en la sesión no se consulta nada (nunca "todas las ventas").
    if (!req.usuario.id_cliente) return res.status(200).json([]);
    const compras = await ventaModel.listar({ idCliente: req.usuario.id_cliente });
    res.status(200).json(compras.map(compraParaCliente));
  } catch (error) {
    next(error);
  }
}

export async function obtenerMiCompra(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const venta = await ventaModel.obtener(id);
    if (!venta || !req.usuario.id_cliente || venta.id_cliente !== req.usuario.id_cliente) throw new ErrorHttp(404, 'La compra no existe.');
    res.status(200).json(compraParaCliente(venta));
  } catch (error) {
    next(error);
  }
}
