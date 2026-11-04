// Controlador de categorías: recibe la petición, valida los datos,
// llama al modelo y responde en JSON.
import * as categoriaModel from '../models/categoriaModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { obtenerCuerpo, validarId, textoObligatorio, textoOpcional } from '../middleware/validaciones.js';

// Revisa y limpia los datos que llegan del formulario.
function validarDatos(cuerpo) {
  return {
    nombre: textoObligatorio(cuerpo.nombre, 'El nombre de la categoría', 60),
    descripcion: textoOpcional(cuerpo.descripcion, 'La descripción', 255)
  };
}

// Busca la categoría o responde 404 si no existe.
async function buscarOFallar(id) {
  const categoria = await categoriaModel.obtenerPorId(id);
  if (!categoria) throw new ErrorHttp(404, 'La categoría no existe.');
  return categoria;
}

// GET /api/categorias
export async function listarCategorias(req, res, next) {
  try {
    const categorias = await categoriaModel.listar();
    res.status(200).json(categorias);
  } catch (error) {
    next(error);
  }
}

// GET /api/categorias/:id
export async function obtenerCategoria(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const categoria = await buscarOFallar(id);
    res.status(200).json(categoria);
  } catch (error) {
    next(error);
  }
}

// POST /api/categorias
export async function crearCategoria(req, res, next) {
  try {
    const datos = validarDatos(obtenerCuerpo(req));
    const idNuevo = await categoriaModel.crear(datos);
    const categoria = await categoriaModel.obtenerPorId(idNuevo);
    res.status(201).json(categoria);
  } catch (error) {
    next(error); // un nombre repetido llega aquí y el middleware responde 409
  }
}

// PUT /api/categorias/:id
export async function actualizarCategoria(req, res, next) {
  try {
    const id = validarId(req.params.id);
    await buscarOFallar(id);
    const datos = validarDatos(obtenerCuerpo(req));
    await categoriaModel.actualizar(id, datos);
    const categoria = await categoriaModel.obtenerPorId(id);
    res.status(200).json(categoria);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/categorias/:id
export async function eliminarCategoria(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const categoria = await buscarOFallar(id);
    const totalProductos = await categoriaModel.contarProductos(id);
    if (totalProductos > 0) {
      throw new ErrorHttp(409, `No se puede eliminar la categoría "${categoria.nombre}" porque tiene ${totalProductos} producto(s) asociado(s).`);
    }
    await categoriaModel.eliminar(id);
    res.status(200).json({ message: 'Categoría eliminada correctamente.', id });
  } catch (error) {
    next(error);
  }
}
