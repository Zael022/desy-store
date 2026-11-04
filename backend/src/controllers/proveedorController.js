// Controlador de proveedores.
import * as proveedorModel from '../models/proveedorModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import {
  obtenerCuerpo,
  validarId,
  textoObligatorio,
  textoOpcional,
  validarCorreo,
  validarTelefono
} from '../middleware/validaciones.js';

function validarDatos(cuerpo) {
  return {
    nombre: textoObligatorio(cuerpo.nombre, 'El nombre del proveedor', 100),
    contacto: textoOpcional(cuerpo.contacto, 'La persona de contacto', 100),
    telefono: validarTelefono(textoObligatorio(cuerpo.telefono, 'El teléfono', 20), 'El teléfono'),
    correo: validarCorreo(textoOpcional(cuerpo.correo, 'El correo', 100), 'El correo'),
    direccion: textoOpcional(cuerpo.direccion, 'La dirección', 255)
  };
}

async function buscarOFallar(id) {
  const proveedor = await proveedorModel.obtenerPorId(id);
  if (!proveedor) throw new ErrorHttp(404, 'El proveedor no existe.');
  return proveedor;
}

// GET /api/proveedores
export async function listarProveedores(req, res, next) {
  try {
    res.status(200).json(await proveedorModel.listar());
  } catch (error) {
    next(error);
  }
}

// GET /api/proveedores/:id
export async function obtenerProveedor(req, res, next) {
  try {
    const id = validarId(req.params.id);
    res.status(200).json(await buscarOFallar(id));
  } catch (error) {
    next(error);
  }
}

// POST /api/proveedores
export async function crearProveedor(req, res, next) {
  try {
    const datos = validarDatos(obtenerCuerpo(req));
    const idNuevo = await proveedorModel.crear(datos);
    res.status(201).json(await proveedorModel.obtenerPorId(idNuevo));
  } catch (error) {
    next(error);
  }
}

// PUT /api/proveedores/:id
export async function actualizarProveedor(req, res, next) {
  try {
    const id = validarId(req.params.id);
    await buscarOFallar(id);
    const datos = validarDatos(obtenerCuerpo(req));
    await proveedorModel.actualizar(id, datos);
    res.status(200).json(await proveedorModel.obtenerPorId(id));
  } catch (error) {
    next(error);
  }
}

// DELETE /api/proveedores/:id
export async function eliminarProveedor(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const proveedor = await buscarOFallar(id);
    const totalProductos = await proveedorModel.contarProductos(id);
    if (totalProductos > 0) {
      throw new ErrorHttp(409, `No se puede eliminar el proveedor "${proveedor.nombre}" porque tiene ${totalProductos} producto(s) asociado(s).`);
    }
    await proveedorModel.eliminar(id);
    res.status(200).json({ message: 'Proveedor eliminado correctamente.', id });
  } catch (error) {
    next(error);
  }
}
