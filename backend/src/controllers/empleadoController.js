// Controlador de empleados.
import * as empleadoModel from '../models/empleadoModel.js';
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
    nombre: textoObligatorio(cuerpo.nombre, 'El nombre del empleado', 100),
    puesto: textoObligatorio(cuerpo.puesto, 'El puesto', 60),
    telefono: validarTelefono(textoOpcional(cuerpo.telefono, 'El teléfono', 20), 'El teléfono'),
    correo: validarCorreo(textoObligatorio(cuerpo.correo, 'El correo', 100), 'El correo')
  };
}

async function buscarOFallar(id) {
  const empleado = await empleadoModel.obtenerPorId(id);
  if (!empleado) throw new ErrorHttp(404, 'El empleado no existe.');
  return empleado;
}

// GET /api/empleados
export async function listarEmpleados(req, res, next) {
  try {
    res.status(200).json(await empleadoModel.listar());
  } catch (error) {
    next(error);
  }
}

// GET /api/empleados/:id
export async function obtenerEmpleado(req, res, next) {
  try {
    const id = validarId(req.params.id);
    res.status(200).json(await buscarOFallar(id));
  } catch (error) {
    next(error);
  }
}

// POST /api/empleados
export async function crearEmpleado(req, res, next) {
  try {
    const datos = validarDatos(obtenerCuerpo(req));
    const idNuevo = await empleadoModel.crear(datos);
    res.status(201).json(await empleadoModel.obtenerPorId(idNuevo));
  } catch (error) {
    next(error);
  }
}

// PUT /api/empleados/:id
export async function actualizarEmpleado(req, res, next) {
  try {
    const id = validarId(req.params.id);
    await buscarOFallar(id);
    const datos = validarDatos(obtenerCuerpo(req));
    await empleadoModel.actualizar(id, datos);
    res.status(200).json(await empleadoModel.obtenerPorId(id));
  } catch (error) {
    next(error);
  }
}

// DELETE /api/empleados/:id
export async function eliminarEmpleado(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const empleado = await buscarOFallar(id);
    const totalMovimientos = await empleadoModel.contarMovimientos(id);
    if (totalMovimientos > 0) {
      throw new ErrorHttp(409, `No se puede eliminar a "${empleado.nombre}" porque registró ${totalMovimientos} movimiento(s) de inventario.`);
    }
    const vinculos = await empleadoModel.contarVinculos(id);
    if (vinculos.cuentas > 0) {
      throw new ErrorHttp(409, `No se puede eliminar a "${empleado.nombre}" porque tiene una cuenta de usuario. Desactive la cuenta en Usuarios.`);
    }
    if (vinculos.ventas > 0) {
      throw new ErrorHttp(409, `No se puede eliminar a "${empleado.nombre}" porque tiene ventas o devoluciones registradas.`);
    }
    await empleadoModel.eliminar(id);
    res.status(200).json({ message: 'Empleado eliminado correctamente.', id });
  } catch (error) {
    next(error);
  }
}
