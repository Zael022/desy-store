// Controlador de productos.
import * as productoModel from '../models/productoModel.js';
import * as categoriaModel from '../models/categoriaModel.js';
import * as proveedorModel from '../models/proveedorModel.js';
import * as materialModel from '../models/materialModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { borrarArchivo } from '../servicios/fotos.js';
import {
  obtenerCuerpo,
  validarId,
  textoObligatorio,
  textoOpcional,
  decimalEnRango
} from '../middleware/validaciones.js';

const PRECIO_MAXIMO = 99999999.99; // lo máximo que cabe en DECIMAL(10,2)

// El costo unitario es información de la dueña: solo ella lo ve y lo cambia.
const MENSAJE_COSTO = 'Solo la dueña puede ver y cambiar el costo unitario.';

function sinCosto(producto, rol) {
  if (!producto || rol === 'duena') return producto;
  const { costo_unitario: _costo, ...resto } = producto;
  return resto;
}

// Lee costo_unitario del cuerpo según el rol. Devuelve {} si no corresponde tocarlo.
function validarCosto(cuerpo, rol) {
  if (!Object.hasOwn(cuerpo, 'costo_unitario')) return {};
  if (rol !== 'duena') throw new ErrorHttp(403, MENSAJE_COSTO);
  if (cuerpo.costo_unitario === null || cuerpo.costo_unitario === '') return { costo_unitario: null };
  return { costo_unitario: decimalEnRango(cuerpo.costo_unitario, 'El costo unitario', 0, PRECIO_MAXIMO, 2) };
}

function validarDatos(cuerpo) {
  // El stock no se edita aquí: solo cambia con entradas y salidas.
  if (Object.hasOwn(cuerpo, 'stock')) {
    throw new ErrorHttp(400, 'El stock no se edita directamente. Registre una entrada o una salida en Movimientos.');
  }

  const codigo = textoObligatorio(cuerpo.codigo, 'El código del producto', 20).toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(codigo)) {
    throw new ErrorHttp(400, 'El código del producto solo puede tener letras, números y guiones (ejemplo: ARE-001).');
  }

  return {
    codigo,
    nombre: textoObligatorio(cuerpo.nombre, 'El nombre del producto', 100),
    descripcion: textoOpcional(cuerpo.descripcion, 'La descripción', 255),
    precio: decimalEnRango(cuerpo.precio, 'El precio', 0, PRECIO_MAXIMO, 2),
    id_categoria: validarId(cuerpo.id_categoria, 'Seleccione una categoría válida.'),
    id_proveedor: validarId(cuerpo.id_proveedor, 'Seleccione un proveedor válido.'),
    id_material: validarId(cuerpo.id_material, 'Seleccione un material válido.')
  };
}

// Revisa que la categoría, el proveedor y el material elegidos existan (400 si no).
async function validarLlavesForaneas(datos) {
  if (!(await categoriaModel.obtenerPorId(datos.id_categoria))) {
    throw new ErrorHttp(400, 'La categoría seleccionada no existe.');
  }
  if (!(await proveedorModel.obtenerPorId(datos.id_proveedor))) {
    throw new ErrorHttp(400, 'El proveedor seleccionado no existe.');
  }
  if (!(await materialModel.obtenerPorId(datos.id_material))) {
    throw new ErrorHttp(400, 'El material seleccionado no existe.');
  }
}

async function buscarOFallar(id) {
  const producto = await productoModel.obtenerPorId(id);
  if (!producto) throw new ErrorHttp(404, 'El producto no existe.');
  return producto;
}

// GET /api/productos
export async function listarProductos(req, res, next) {
  try {
    const productos = await productoModel.listar();
    res.status(200).json(productos.map((p) => sinCosto(p, req.usuario.rol)));
  } catch (error) {
    next(error);
  }
}

// GET /api/productos/:id
export async function obtenerProducto(req, res, next) {
  try {
    const id = validarId(req.params.id);
    res.status(200).json(sinCosto(await buscarOFallar(id), req.usuario.rol));
  } catch (error) {
    next(error);
  }
}

// POST /api/productos
export async function crearProducto(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const datos = { ...validarDatos(cuerpo), ...validarCosto(cuerpo, req.usuario.rol) };
    await validarLlavesForaneas(datos);
    const idNuevo = await productoModel.crear(datos);
    res.status(201).json(sinCosto(await productoModel.obtenerPorId(idNuevo), req.usuario.rol));
  } catch (error) {
    next(error);
  }
}

// PUT /api/productos/:id
export async function actualizarProducto(req, res, next) {
  try {
    const id = validarId(req.params.id);
    await buscarOFallar(id);
    const cuerpo = obtenerCuerpo(req);
    const datos = { ...validarDatos(cuerpo), ...validarCosto(cuerpo, req.usuario.rol) };
    await validarLlavesForaneas(datos);
    await productoModel.actualizar(id, datos);
    res.status(200).json(sinCosto(await productoModel.obtenerPorId(id), req.usuario.rol));
  } catch (error) {
    next(error);
  }
}

// DELETE /api/productos/:id
export async function eliminarProducto(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const producto = await buscarOFallar(id);
    const totalMovimientos = await productoModel.contarMovimientos(id);
    if (totalMovimientos > 0) {
      throw new ErrorHttp(409, `No se puede eliminar el producto "${producto.nombre}" porque tiene ${totalMovimientos} movimiento(s) de inventario registrados.`);
    }
    const archivos = await productoModel.eliminar(id);
    for (const archivo of archivos) await borrarArchivo(archivo);
    res.status(200).json({ message: 'Producto eliminado correctamente.', id });
  } catch (error) {
    next(error);
  }
}
