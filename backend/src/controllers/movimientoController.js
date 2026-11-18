// Controlador de movimientos de inventario (entradas y salidas).
// La validación de los datos se hace aquí; las reglas del stock y las
// transacciones están en models/movimientoModel.js.
//
// Seguridad: el empleado responsable sale de la SESIÓN (la persona que tiene
// la sesión abierta), nunca de lo que envíe el navegador. Al editar, el
// movimiento conserva al empleado que lo registró.
import * as movimientoModel from '../models/movimientoModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { STOCK_MAXIMO, TIPOS_MOVIMIENTO } from '../config/constantes.js';
import {
  obtenerCuerpo,
  validarId,
  textoOpcional,
  enteroEnRango,
  valorDeLista,
  validarFecha
} from '../middleware/validaciones.js';

function validarDatos(cuerpo) {
  return {
    id_producto: validarId(cuerpo.id_producto, 'Seleccione un producto válido.'),
    tipo: valorDeLista(cuerpo.tipo, 'El tipo de movimiento', TIPOS_MOVIMIENTO),
    // Ningún movimiento puede mover más unidades que el máximo permitido.
    cantidad: enteroEnRango(cuerpo.cantidad, 'La cantidad', 1, STOCK_MAXIMO),
    fecha: validarFecha(cuerpo.fecha, 'La fecha'),
    motivo: textoOpcional(cuerpo.motivo, 'El motivo', 255)
  };
}

// Toda cuenta interna está vinculada a un empleado (lo garantiza un CHECK en la base).
function empleadoDeSesion(req) {
  if (!req.usuario.id_empleado) throw new ErrorHttp(403, 'Su cuenta no está vinculada a un empleado.');
  return req.usuario.id_empleado;
}

// GET /api/movimientos
export async function listarMovimientos(req, res, next) {
  try {
    res.status(200).json(await movimientoModel.listar());
  } catch (error) {
    next(error);
  }
}

// GET /api/movimientos/:id
export async function obtenerMovimiento(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const movimiento = await movimientoModel.obtenerPorId(id);
    if (!movimiento) throw new ErrorHttp(404, 'El movimiento no existe.');
    res.status(200).json(movimiento);
  } catch (error) {
    next(error);
  }
}

// POST /api/movimientos
export async function crearMovimiento(req, res, next) {
  try {
    const datos = { ...validarDatos(obtenerCuerpo(req)), id_empleado: empleadoDeSesion(req) };
    const idNuevo = await movimientoModel.crear(datos); // valida el producto y el stock
    res.status(201).json(await movimientoModel.obtenerPorId(idNuevo));
  } catch (error) {
    next(error);
  }
}

// PUT /api/movimientos/:id
export async function actualizarMovimiento(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const actual = await movimientoModel.obtenerPorId(id);
    if (!actual) throw new ErrorHttp(404, 'El movimiento no existe.');
    const datos = { ...validarDatos(obtenerCuerpo(req)), id_empleado: actual.id_empleado };
    await movimientoModel.actualizar(id, datos);
    res.status(200).json(await movimientoModel.obtenerPorId(id));
  } catch (error) {
    next(error);
  }
}

// DELETE /api/movimientos/:id
export async function eliminarMovimiento(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const { stockResultante, nombreProducto } = await movimientoModel.eliminar(id); // 404 si no existe
    res.status(200).json({
      message: `Movimiento eliminado. El stock de "${nombreProducto}" quedó en ${stockResultante}.`,
      id,
      stock_resultante: stockResultante
    });
  } catch (error) {
    next(error);
  }
}
