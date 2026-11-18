// Controlador de categorías: recibe la petición, valida los datos,
// llama al modelo y responde en JSON.
import * as categoriaModel from '../models/categoriaModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { obtenerCuerpo, validarId, textoObligatorio, textoOpcional } from '../middleware/validaciones.js';

// Revisa y limpia los datos que llegan del formulario.
// id_categoria_padre: vacío o null = categoría principal; un ID = subcategoría de esa.
// Si al editar no se envía, se deja la que ya tenía (devuelve undefined).
function validarDatos(cuerpo) {
  const datos = {
    nombre: textoObligatorio(cuerpo.nombre, 'El nombre de la categoría', 60),
    descripcion: textoOpcional(cuerpo.descripcion, 'La descripción', 255)
  };
  if (Object.hasOwn(cuerpo, 'id_categoria_padre')) {
    const padre = cuerpo.id_categoria_padre;
    datos.id_categoria_padre = padre === null || padre === '' ? null : validarId(padre, 'Seleccione una categoría principal válida.');
  }
  return datos;
}

// Reglas de las subcategorías (solo dos niveles: Crochet > Peluches, nunca más abajo).
async function validarPadre(idPadre, idCategoria = null) {
  if (idPadre === null || idPadre === undefined) return;
  if (idPadre === idCategoria) throw new ErrorHttp(400, 'Una categoría no puede estar dentro de sí misma.');
  const padre = await categoriaModel.obtenerPorId(idPadre);
  if (!padre) throw new ErrorHttp(400, 'La categoría principal seleccionada no existe.');
  if (padre.id_categoria_padre !== null) {
    throw new ErrorHttp(400, `"${padre.nombre}" ya es una subcategoría. Elija una categoría principal (solo hay dos niveles).`);
  }
  if (idCategoria !== null && (await categoriaModel.contarSubcategorias(idCategoria)) > 0) {
    throw new ErrorHttp(400, 'Esta categoría tiene subcategorías, así que no puede quedar dentro de otra.');
  }
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
    await validarPadre(datos.id_categoria_padre);
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
    const actual = await buscarOFallar(id);
    const datos = validarDatos(obtenerCuerpo(req));
    if (datos.id_categoria_padre === undefined) datos.id_categoria_padre = actual.id_categoria_padre;
    else await validarPadre(datos.id_categoria_padre, id);
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
    const totalSubcategorias = await categoriaModel.contarSubcategorias(id);
    if (totalSubcategorias > 0) {
      throw new ErrorHttp(409, `No se puede eliminar la categoría "${categoria.nombre}" porque tiene ${totalSubcategorias} subcategoría(s). Muévalas o elimínelas primero.`);
    }
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
