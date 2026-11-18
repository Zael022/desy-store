// Portal del proveedor. El proveedor SIEMPRE sale de la sesión
// (req.usuario.id_proveedor): aunque alguien cambie un número en la URL o en el
// cuerpo, solo ve y toca lo suyo. Lo de otro proveedor se responde con 404.
import pool from '../config/db.js';
import * as proveedorModel from '../models/proveedorModel.js';
import * as abastecimientoModel from '../models/abastecimientoModel.js';
import * as configuracionModel from '../models/configuracionModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import {
  obtenerCuerpo,
  validarId,
  textoObligatorio,
  textoOpcional,
  validarCorreo,
  validarTelefono,
  valorDeLista
} from '../middleware/validaciones.js';
import { registrarAuditoria, ipDe } from '../servicios/auditoria.js';

function idProveedorDeSesion(req) {
  if (!req.usuario.id_proveedor) throw new ErrorHttp(403, 'Esta cuenta no está vinculada a un proveedor.');
  return req.usuario.id_proveedor;
}

// GET /api/portal-proveedor/productos
export async function listarMisProductos(req, res, next) {
  try {
    const idProveedor = idProveedorDeSesion(req);
    const { umbral_pocas_unidades: umbral, proveedor_ve_stock: veStock } = await configuracionModel.obtenerValores();
    const [filas] = await pool.execute(
      `SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, p.stock, c.nombre AS nombre_categoria, m.nombre AS nombre_material
         FROM productos p
         JOIN categorias c ON c.id_categoria = p.id_categoria
         JOIN materiales m ON m.id_material = p.id_material
        WHERE p.id_proveedor = ?
        ORDER BY p.nombre`,
      [idProveedor]
    );
    // El stock exacto solo se muestra si la dueña lo permitió en la configuración.
    res.status(200).json(
      filas.map(({ stock, ...p }) => ({
        ...p,
        disponibilidad: configuracionModel.disponibilidad(stock, umbral),
        ...(veStock ? { stock } : {})
      }))
    );
  } catch (error) {
    next(error);
  }
}

// GET /api/portal-proveedor/datos
export async function obtenerMisDatos(req, res, next) {
  try {
    const proveedor = await proveedorModel.obtenerPorId(idProveedorDeSesion(req));
    const { total_productos: totalProductos, ...datos } = proveedor;
    res.status(200).json({ ...datos, total_productos: totalProductos });
  } catch (error) {
    next(error);
  }
}

// PUT /api/portal-proveedor/datos   { contacto, telefono, correo, direccion }  (el nombre lo cambia la tienda)
export async function actualizarMisDatos(req, res, next) {
  try {
    const idProveedor = idProveedorDeSesion(req);
    const cuerpo = obtenerCuerpo(req);
    const actual = await proveedorModel.obtenerPorId(idProveedor);
    const datos = {
      nombre: actual.nombre,
      contacto: textoOpcional(cuerpo.contacto, 'La persona de contacto', 100),
      telefono: validarTelefono(textoObligatorio(cuerpo.telefono, 'El teléfono', 20), 'El teléfono'),
      correo: validarCorreo(textoOpcional(cuerpo.correo, 'El correo', 100), 'El correo'),
      direccion: textoOpcional(cuerpo.direccion, 'La dirección', 255)
    };
    await proveedorModel.actualizar(idProveedor, datos);
    await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: 'proveedor_actualizo_datos', detalle: `Proveedor #${idProveedor}`, ip: ipDe(req) });
    res.status(200).json(await proveedorModel.obtenerPorId(idProveedor));
  } catch (error) {
    next(error);
  }
}

// GET /api/portal-proveedor/solicitudes
export async function listarMisSolicitudes(req, res, next) {
  try {
    res.status(200).json(await abastecimientoModel.listar({ idProveedor: idProveedorDeSesion(req) }));
  } catch (error) {
    next(error);
  }
}

// GET /api/portal-proveedor/solicitudes/:id
export async function obtenerMiSolicitud(req, res, next) {
  try {
    const idProveedor = idProveedorDeSesion(req);
    const solicitud = await abastecimientoModel.obtener(validarId(req.params.id));
    if (!solicitud || solicitud.id_proveedor !== idProveedor) throw new ErrorHttp(404, 'La solicitud no existe.');
    res.status(200).json(solicitud);
  } catch (error) {
    next(error);
  }
}

// PATCH /api/portal-proveedor/solicitudes/:id/respuesta   { decision: "aceptada"|"rechazada", comentario }
export async function responderSolicitud(req, res, next) {
  try {
    const idProveedor = idProveedorDeSesion(req);
    const cuerpo = obtenerCuerpo(req);
    const decision = valorDeLista(cuerpo.decision, 'La decisión', ['aceptada', 'rechazada']);
    const comentario = decision === 'rechazada'
      ? textoObligatorio(cuerpo.comentario, 'El motivo del rechazo', 255)
      : textoOpcional(cuerpo.comentario, 'El comentario', 255);
    const solicitud = await abastecimientoModel.responder({
      idSolicitud: validarId(req.params.id),
      soloProveedor: idProveedor,
      decision,
      comentario,
      idUsuario: req.usuario.id_usuario,
      ip: ipDe(req)
    });
    res.status(200).json({ ...solicitud, message: decision === 'aceptada' ? 'Solicitud aceptada.' : 'Solicitud rechazada.' });
  } catch (error) {
    next(error);
  }
}
