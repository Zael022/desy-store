// Controlador de materiales.
import * as materialModel from '../models/materialModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import {
  obtenerCuerpo,
  validarId,
  textoObligatorio,
  textoOpcional,
  validarBooleano
} from '../middleware/validaciones.js';

function validarDatos(cuerpo) {
  return {
    nombre: textoObligatorio(cuerpo.nombre, 'El nombre del material', 60),
    es_hipoalergenico: validarBooleano(cuerpo.es_hipoalergenico, 'El campo "¿Es hipoalergénico?"'),
    descripcion: textoOpcional(cuerpo.descripcion, 'La descripción', 255)
  };
}

async function buscarOFallar(id) {
  const material = await materialModel.obtenerPorId(id);
  if (!material) throw new ErrorHttp(404, 'El material no existe.');
  return material;
}

// GET /api/materiales
export async function listarMateriales(req, res, next) {
  try {
    res.status(200).json(await materialModel.listar());
  } catch (error) {
    next(error);
  }
}

// GET /api/materiales/:id
export async function obtenerMaterial(req, res, next) {
  try {
    const id = validarId(req.params.id);
    res.status(200).json(await buscarOFallar(id));
  } catch (error) {
    next(error);
  }
}

// POST /api/materiales
export async function crearMaterial(req, res, next) {
  try {
    const datos = validarDatos(obtenerCuerpo(req));
    const idNuevo = await materialModel.crear(datos);
    res.status(201).json(await materialModel.obtenerPorId(idNuevo));
  } catch (error) {
    next(error);
  }
}

// PUT /api/materiales/:id
export async function actualizarMaterial(req, res, next) {
  try {
    const id = validarId(req.params.id);
    await buscarOFallar(id);
    const datos = validarDatos(obtenerCuerpo(req));
    await materialModel.actualizar(id, datos);
    res.status(200).json(await materialModel.obtenerPorId(id));
  } catch (error) {
    next(error);
  }
}

// DELETE /api/materiales/:id
export async function eliminarMaterial(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const material = await buscarOFallar(id);
    const totalProductos = await materialModel.contarProductos(id);
    if (totalProductos > 0) {
      throw new ErrorHttp(409, `No se puede eliminar el material "${material.nombre}" porque tiene ${totalProductos} producto(s) asociado(s).`);
    }
    await materialModel.eliminar(id);
    res.status(200).json({ message: 'Material eliminado correctamente.', id });
  } catch (error) {
    next(error);
  }
}
