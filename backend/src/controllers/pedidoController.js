// Pedidos de clientes.
//   Cliente:  GET/POST /api/mis-pedidos, GET /api/mis-pedidos/:id, PATCH /api/mis-pedidos/:id/cancelar
//   Tienda (ventas, administración y dueña):
//             GET /api/pedidos, GET /api/pedidos/resumen, GET /api/pedidos/:id,
//             PATCH /api/pedidos/:id/confirmar | /rechazar | /entregar
// El cliente, el empleado y quien atiende salen SIEMPRE de la sesión (req.usuario),
// nunca de lo que envía el navegador.
import * as pedidoModel from '../models/pedidoModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { obtenerCuerpo, validarId, textoObligatorio, textoOpcional, enteroEnRango } from '../middleware/validaciones.js';
import { ipDe } from '../servicios/auditoria.js';
import { avisarPedido } from '../servicios/avisosPedidos.js';

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Filtros de la bandeja de la tienda.
const FILTROS = {
  pendientes: ['pendiente'],
  confirmados: ['confirmado'],
  activos: ['pendiente', 'confirmado'],
  historial: ['entregado', 'rechazado', 'cancelado', 'vencido'],
  todos: null
};

// Vence los pedidos atrasados y avisa a sus clientes (sin hacer esperar la respuesta).
export async function vencerYAvisar() {
  const vencidos = await pedidoModel.vencerAtrasados();
  for (const pedido of vencidos) avisarPedido(pedido, 'vencido');
  return vencidos.length;
}

function clienteDeSesion(usuario) {
  if (!usuario.id_cliente) throw new ErrorHttp(403, 'Su cuenta no tiene perfil de cliente.');
  return usuario.id_cliente;
}

// ---------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------

// POST /api/mis-pedidos  { clave_idempotencia, nota?, items: [{ id_producto, cantidad }] }
export async function crearPedido(req, res, next) {
  try {
    const idCliente = clienteDeSesion(req.usuario);
    const cuerpo = obtenerCuerpo(req);
    if (typeof cuerpo.clave_idempotencia !== 'string' || !PATRON_UUID.test(cuerpo.clave_idempotencia)) {
      throw new ErrorHttp(400, 'Falta la clave del pedido o no es válida. Recargue la página.');
    }
    if (!Array.isArray(cuerpo.items) || cuerpo.items.length === 0) throw new ErrorHttp(400, 'Agregue al menos un producto al pedido.');
    if (cuerpo.items.length > pedidoModel.MAXIMO_LINEAS) {
      throw new ErrorHttp(400, `Un pedido puede tener como máximo ${pedidoModel.MAXIMO_LINEAS} productos distintos.`);
    }
    const vistos = new Set();
    const items = cuerpo.items.map((item, posicion) => {
      if (item === null || typeof item !== 'object') throw new ErrorHttp(400, `El producto en la posición ${posicion + 1} no es válido.`);
      const idProducto = validarId(item.id_producto, `El producto en la posición ${posicion + 1} no es válido.`);
      if (vistos.has(idProducto)) throw new ErrorHttp(400, 'Un producto aparece dos veces en el pedido: sume las cantidades en una sola línea.');
      vistos.add(idProducto);
      return { id_producto: idProducto, cantidad: enteroEnRango(item.cantidad, 'La cantidad', 1, pedidoModel.MAXIMO_UNIDADES_POR_PRODUCTO) };
    });

    await vencerYAvisar(); // libera lo vencido antes de revisar lo disponible
    const { pedido, repetido } = await pedidoModel.crear(
      { clave: cuerpo.clave_idempotencia.toLowerCase(), idCliente, idUsuario: req.usuario.id_usuario, nota: textoOpcional(cuerpo.nota, 'La nota', 255), items },
      { ip: ipDe(req) }
    );
    if (!repetido) avisarPedido(pedido, 'recibido');
    res.status(repetido ? 200 : 201).json({
      ...pedido,
      repetido,
      message: repetido
        ? `El pedido #${pedido.id_pedido} ya estaba registrado; no se duplicó.`
        : `Pedido #${pedido.id_pedido} enviado. Las unidades quedaron apartadas: espere la confirmación de la tienda.`
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/mis-pedidos
export async function listarMisPedidos(req, res, next) {
  try {
    const idCliente = clienteDeSesion(req.usuario);
    await vencerYAvisar();
    res.status(200).json(await pedidoModel.listar({ idCliente }));
  } catch (error) {
    next(error);
  }
}

// GET /api/mis-pedidos/:id  (un pedido de otro cliente -> 404)
export async function obtenerMiPedido(req, res, next) {
  try {
    const idCliente = clienteDeSesion(req.usuario);
    const pedido = await pedidoModel.obtener(validarId(req.params.id));
    if (!pedido || pedido.id_cliente !== idCliente) throw new ErrorHttp(404, 'El pedido no existe.');
    res.status(200).json(pedido);
  } catch (error) {
    next(error);
  }
}

// PATCH /api/mis-pedidos/:id/cancelar
export async function cancelarMiPedido(req, res, next) {
  try {
    const idCliente = clienteDeSesion(req.usuario);
    const pedido = await pedidoModel.cancelarPorCliente(validarId(req.params.id), { idCliente, idUsuario: req.usuario.id_usuario, ip: ipDe(req) });
    res.status(200).json({ ...pedido, message: `Pedido #${pedido.id_pedido} cancelado. Las unidades se liberaron.` });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// Tienda
// ---------------------------------------------------------------------

// GET /api/pedidos?filtro=pendientes|confirmados|activos|historial|todos
export async function listarPedidos(req, res, next) {
  try {
    const filtro = req.query.filtro ?? 'activos';
    if (!Object.hasOwn(FILTROS, filtro)) throw new ErrorHttp(400, 'Filtro de pedidos desconocido.');
    await vencerYAvisar();
    res.status(200).json(await pedidoModel.listar({ estados: FILTROS[filtro] }));
  } catch (error) {
    next(error);
  }
}

// GET /api/pedidos/resumen -> { pendientes, confirmados } (para el aviso del menú)
export async function resumenPedidos(req, res, next) {
  try {
    await vencerYAvisar();
    const activos = await pedidoModel.listar({ estados: ['pendiente', 'confirmado'] });
    res.status(200).json({
      pendientes: activos.filter((p) => p.estado === 'pendiente').length,
      confirmados: activos.filter((p) => p.estado === 'confirmado').length
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/pedidos/:id
export async function obtenerPedido(req, res, next) {
  try {
    const pedido = await pedidoModel.obtener(validarId(req.params.id));
    if (!pedido) throw new ErrorHttp(404, 'El pedido no existe.');
    res.status(200).json(pedido);
  } catch (error) {
    next(error);
  }
}

// PATCH /api/pedidos/:id/confirmar
export async function confirmarPedido(req, res, next) {
  try {
    const pedido = await pedidoModel.confirmar(validarId(req.params.id), { idUsuario: req.usuario.id_usuario, ip: ipDe(req) });
    const avisado = await avisarPedido(pedido, 'confirmado');
    res.status(200).json({
      ...pedido,
      avisado,
      message: `Pedido #${pedido.id_pedido} confirmado.${avisado ? ' Se le avisó al cliente por correo.' : ' No se pudo enviar el correo; el cliente lo verá en "Mis pedidos".'}`
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/pedidos/:id/rechazar  { motivo }
export async function rechazarPedido(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const motivo = textoObligatorio(obtenerCuerpo(req).motivo, 'El motivo', 255);
    if (motivo.length < 3) throw new ErrorHttp(400, 'Escriba el motivo para el cliente (al menos 3 letras).');
    const pedido = await pedidoModel.rechazar(id, { idUsuario: req.usuario.id_usuario, motivo, ip: ipDe(req) });
    const avisado = await avisarPedido(pedido, 'rechazado');
    res.status(200).json({
      ...pedido,
      avisado,
      message: `Pedido #${pedido.id_pedido} rechazado; las unidades se liberaron.${avisado ? ' Se le avisó al cliente por correo.' : ''}`
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/pedidos/:id/entregar  -> registra la venta (se cobra al entregar)
export async function entregarPedido(req, res, next) {
  try {
    const id = validarId(req.params.id);
    if (!req.usuario.id_empleado) throw new ErrorHttp(409, 'Su cuenta no está vinculada a un empleado, así que no puede registrar ventas.');
    const { pedido, idVenta } = await pedidoModel.entregar(id, { idUsuario: req.usuario.id_usuario, idEmpleado: req.usuario.id_empleado, ip: ipDe(req) });
    res.status(200).json({ ...pedido, message: `Pedido #${pedido.id_pedido} entregado. Se registró la venta #${idVenta}.` });
  } catch (error) {
    next(error);
  }
}
