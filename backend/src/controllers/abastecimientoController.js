// Controlador de solicitudes de abastecimiento.
//   - Administración y dueña: crear, ver, recibir y cancelar.
//   - Proveedor (portal-proveedor): ver las suyas y aceptarlas o rechazarlas.
import { STOCK_MAXIMO } from '../config/constantes.js';
import * as abastecimientoModel from '../models/abastecimientoModel.js';
import * as proveedorModel from '../models/proveedorModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { obtenerCuerpo, validarId, textoOpcional, enteroEnRango, valorDeLista } from '../middleware/validaciones.js';
import { ipDe } from '../servicios/auditoria.js';

export const ESTADOS = ['pendiente', 'aceptada', 'rechazada', 'recibida', 'cancelada'];

// GET /api/abastecimiento?estado=&id_proveedor=
export async function listarSolicitudes(req, res, next) {
  try {
    const estado = req.query.estado ? valorDeLista(req.query.estado, 'El estado', ESTADOS) : null;
    const idProveedor = req.query.id_proveedor ? validarId(req.query.id_proveedor, 'El proveedor no es válido.') : null;
    res.status(200).json(await abastecimientoModel.listar({ estado, idProveedor }));
  } catch (error) {
    next(error);
  }
}

// GET /api/abastecimiento/:id
export async function obtenerSolicitud(req, res, next) {
  try {
    const solicitud = await abastecimientoModel.obtener(validarId(req.params.id), { conStock: true });
    if (!solicitud) throw new ErrorHttp(404, 'La solicitud no existe.');
    res.status(200).json(solicitud);
  } catch (error) {
    next(error);
  }
}

// POST /api/abastecimiento   { id_proveedor, nota?, items: [{ id_producto, cantidad }] }
export async function crearSolicitud(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const idProveedor = validarId(cuerpo.id_proveedor, 'Seleccione un proveedor válido.');
    if (!(await proveedorModel.obtenerPorId(idProveedor))) throw new ErrorHttp(400, 'El proveedor seleccionado no existe.');
    if (!Array.isArray(cuerpo.items) || cuerpo.items.length === 0) throw new ErrorHttp(400, 'Agregue al menos un producto a la solicitud.');
    if (cuerpo.items.length > 50) throw new ErrorHttp(400, 'Una solicitud puede tener como máximo 50 productos.');
    const vistos = new Set();
    const items = cuerpo.items.map((item) => {
      if (item === null || typeof item !== 'object') throw new ErrorHttp(400, 'Un producto de la solicitud no es válido.');
      const idProducto = validarId(item.id_producto, 'Un producto de la solicitud no es válido.');
      if (vistos.has(idProducto)) throw new ErrorHttp(400, 'Un producto aparece dos veces en la solicitud.');
      vistos.add(idProducto);
      return { id_producto: idProducto, cantidad: enteroEnRango(item.cantidad, 'La cantidad solicitada', 1, STOCK_MAXIMO) };
    });
    const solicitud = await abastecimientoModel.crear(
      { idProveedor, idUsuario: req.usuario.id_usuario, nota: textoOpcional(cuerpo.nota, 'La nota', 255), items },
      { ip: ipDe(req) }
    );
    res.status(201).json(solicitud);
  } catch (error) {
    next(error);
  }
}

// PATCH /api/abastecimiento/:id/recibir
export async function recibirSolicitud(req, res, next) {
  try {
    const solicitud = await abastecimientoModel.recibir({
      idSolicitud: validarId(req.params.id),
      idUsuario: req.usuario.id_usuario,
      idEmpleado: req.usuario.id_empleado,
      ip: ipDe(req)
    });
    res.status(200).json({ ...solicitud, message: `Solicitud #${solicitud.id_solicitud} recibida: las unidades entraron al inventario.` });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/abastecimiento/:id/cancelar
export async function cancelarSolicitud(req, res, next) {
  try {
    const solicitud = await abastecimientoModel.cancelar({ idSolicitud: validarId(req.params.id), idUsuario: req.usuario.id_usuario, ip: ipDe(req) });
    res.status(200).json({ ...solicitud, message: `Solicitud #${solicitud.id_solicitud} cancelada.` });
  } catch (error) {
    next(error);
  }
}
