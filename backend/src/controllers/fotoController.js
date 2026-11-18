// Controlador de fotos de productos.
//   GET    /api/fotos/:archivo                          (público: muestra la imagen)
//   GET    /api/productos/:id/fotos                     (administración y dueña)
//   POST   /api/productos/:id/fotos                     (subir UNA foto, campo "foto")
//   PATCH  /api/productos/:id/fotos/:idFoto/principal   (ponerla de primera)
//   PATCH  /api/productos/:id/fotos/:idFoto/medidas     (marcarla como foto con medidas)
//   DELETE /api/productos/:id/fotos/:idFoto
//
// Regla: una foto con medidas NUNCA es la principal. Va siempre al final y no se usa
// en las tarjetas del catálogo (ver models/fotoModel.js).
import fs from 'node:fs/promises';
import multer from 'multer';
import { enTransaccion } from '../config/db.js';
import * as fotoModel from '../models/fotoModel.js';
import * as productoModel from '../models/productoModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { obtenerCuerpo, validarId } from '../middleware/validaciones.js';
import { registrarAuditoria, ipDe } from '../servicios/auditoria.js';
import {
  MAXIMO_FOTOS_POR_PRODUCTO,
  TAMANO_MAXIMO_BYTES,
  borrarArchivo,
  guardarFoto,
  prepararImagen,
  rutaDeFoto
} from '../servicios/fotos.js';

// multer lee el formulario "multipart/form-data" y deja la foto en memoria (req.file).
// Solo se acepta UN archivo en el campo "foto", de 5 MB como máximo.
const lectorDeFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO_BYTES, files: 1, fields: 5, parts: 6 }
}).single('foto');

// Traduce los errores de multer a mensajes claros.
export function recibirFoto(req, res, next) {
  lectorDeFoto(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(new ErrorHttp(413, 'La foto pesa más de 5 MB. Elija una más liviana.'));
    if (error instanceof multer.MulterError) return next(new ErrorHttp(400, 'Envíe una sola foto en el campo "foto".'));
    return next(new ErrorHttp(400, 'No se pudo leer la foto enviada.'));
  });
}

async function productoOFallar(id) {
  const producto = await productoModel.obtenerPorId(id);
  if (!producto) throw new ErrorHttp(404, 'El producto no existe.');
  return producto;
}

const aRespuesta = (fotos) => fotos.map(({ id_foto, archivo, orden, es_de_medidas }) => ({ id_foto, archivo, orden, es_de_medidas }));

// Lee "es_de_medidas" como verdadero o falso (en el formulario de fotos llega como texto).
function leerMedidas(valor, obligatorio = false) {
  if (valor === true || valor === 'true') return true;
  if (valor === false || valor === 'false' || (!obligatorio && (valor === undefined || valor === ''))) return false;
  throw new ErrorHttp(400, 'Indique si es una foto con medidas (verdadero o falso).');
}

// GET /api/fotos/:archivo
export async function servirFoto(req, res, next) {
  try {
    const ruta = rutaDeFoto(req.params.archivo);
    if (!ruta) throw new ErrorHttp(404, 'La foto no existe.');
    try {
      await fs.access(ruta);
    } catch {
      throw new ErrorHttp(404, 'La foto no existe.');
    }
    // Las fotos no son privadas: el navegador las puede guardar un día en caché.
    res.set('Cache-Control', 'public, max-age=86400');
    // Son públicas: se permite mostrarlas aunque el frontend esté en otra dirección.
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.type('image/webp').sendFile(ruta);
  } catch (error) {
    next(error);
  }
}

// GET /api/productos/:id/fotos
export async function listarFotos(req, res, next) {
  try {
    const id = validarId(req.params.id);
    await productoOFallar(id);
    res.status(200).json(aRespuesta(await fotoModel.listarPorProducto(id)));
  } catch (error) {
    next(error);
  }
}

// POST /api/productos/:id/fotos
export async function subirFoto(req, res, next) {
  let archivo = null;
  try {
    const id = validarId(req.params.id);
    const producto = await productoOFallar(id);
    if (!req.file) throw new ErrorHttp(400, 'Elija una foto (JPG, PNG o WebP) en el campo "foto".');
    const esDeMedidas = leerMedidas(req.body?.es_de_medidas); // opcional en el mismo formulario

    // Revisión rápida antes de procesar la imagen.
    if ((await fotoModel.listarPorProducto(id)).length >= MAXIMO_FOTOS_POR_PRODUCTO) {
      throw new ErrorHttp(409, `Cada producto puede tener como máximo ${MAXIMO_FOTOS_POR_PRODUCTO} fotos. Borre una antes de subir otra.`);
    }

    const imagen = await prepararImagen(req.file.buffer);
    archivo = await guardarFoto(imagen);

    const fotos = await enTransaccion(async (conexion) => {
      // Se bloquea el producto para que dos subidas al mismo tiempo no pasen el máximo.
      await conexion.execute('SELECT id_producto FROM productos WHERE id_producto = ? FOR UPDATE', [id]);
      const actuales = await fotoModel.listarPorProducto(id, conexion);
      if (actuales.length >= MAXIMO_FOTOS_POR_PRODUCTO) {
        throw new ErrorHttp(409, `Cada producto puede tener como máximo ${MAXIMO_FOTOS_POR_PRODUCTO} fotos. Borre una antes de subir otra.`);
      }
      await fotoModel.crear(conexion, id, archivo, esDeMedidas);
      await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: 'foto_agregada', detalle: `Producto ${producto.codigo}${esDeMedidas ? ' (con medidas)' : ''}`, ip: ipDe(req) }, conexion);
      return fotoModel.listarPorProducto(id, conexion);
    });
    res.status(201).json(aRespuesta(fotos));
  } catch (error) {
    if (archivo) await borrarArchivo(archivo); // no dejar archivos sueltos si algo falló
    next(error);
  }
}

// PATCH /api/productos/:id/fotos/:idFoto/principal
export async function hacerPrincipal(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const idFoto = validarId(req.params.idFoto);
    const producto = await productoOFallar(id);
    const fotos = await enTransaccion(async (conexion) => {
      const foto = await fotoModel.obtener(idFoto, id, conexion);
      if (!foto) throw new ErrorHttp(404, 'La foto no existe.');
      if (foto.es_de_medidas) {
        throw new ErrorHttp(409, 'Una foto con medidas no puede ser la principal. Quítele la marca de medidas o elija otra foto.');
      }
      await fotoModel.hacerPrincipal(conexion, idFoto, id);
      await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: 'foto_principal', detalle: `Producto ${producto.codigo}`, ip: ipDe(req) }, conexion);
      return fotoModel.listarPorProducto(id, conexion);
    });
    res.status(200).json(aRespuesta(fotos));
  } catch (error) {
    next(error);
  }
}

// PATCH /api/productos/:id/fotos/:idFoto/medidas   { "es_de_medidas": true }
export async function marcarMedidas(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const idFoto = validarId(req.params.idFoto);
    const esDeMedidas = leerMedidas(obtenerCuerpo(req).es_de_medidas, true);
    const producto = await productoOFallar(id);
    const fotos = await enTransaccion(async (conexion) => {
      if (!(await fotoModel.obtener(idFoto, id, conexion))) throw new ErrorHttp(404, 'La foto no existe.');
      await fotoModel.marcarMedidas(conexion, idFoto, id, esDeMedidas);
      await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: esDeMedidas ? 'foto_marcada_medidas' : 'foto_desmarcada_medidas', detalle: `Producto ${producto.codigo}`, ip: ipDe(req) }, conexion);
      return fotoModel.listarPorProducto(id, conexion);
    });
    res.status(200).json(aRespuesta(fotos));
  } catch (error) {
    next(error);
  }
}

// DELETE /api/productos/:id/fotos/:idFoto
export async function eliminarFoto(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const idFoto = validarId(req.params.idFoto);
    const producto = await productoOFallar(id);
    const { archivo, fotos } = await enTransaccion(async (conexion) => {
      const foto = await fotoModel.obtener(idFoto, id, conexion);
      if (!foto) throw new ErrorHttp(404, 'La foto no existe.');
      await fotoModel.eliminar(conexion, idFoto, id);
      await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: 'foto_eliminada', detalle: `Producto ${producto.codigo}`, ip: ipDe(req) }, conexion);
      return { archivo: foto.archivo, fotos: await fotoModel.listarPorProducto(id, conexion) };
    });
    await borrarArchivo(archivo); // primero se borra de la base; después, el archivo
    res.status(200).json(aRespuesta(fotos));
  } catch (error) {
    next(error);
  }
}
