// Catálogo público (para visitantes y clientes).
// Nunca muestra el stock exacto, el costo, el proveedor ni los movimientos:
// solo la disponibilidad ("disponible", "pocas" o "agotado").
// Las fotos se envían como nombres de archivo; la imagen está en GET /api/fotos/:archivo.
import pool from '../config/db.js';
import * as configuracionModel from '../models/configuracionModel.js';
import * as fotoModel from '../models/fotoModel.js';
import { sqlApartado } from '../models/apartados.js';
import { ErrorHttp } from '../middleware/errores.js';
import { validarId } from '../middleware/validaciones.js';

const SELECT_CATALOGO = `
  SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, p.precio,
         GREATEST(p.stock - ${sqlApartado('p')}, 0) AS stock, -- lo que se puede pedir (stock menos lo apartado)
         p.id_categoria, c.nombre AS nombre_categoria,
         c.id_categoria_padre, cp.nombre AS nombre_categoria_padre,
         p.id_material, m.nombre AS nombre_material, m.es_hipoalergenico,
         (SELECT f.archivo FROM producto_fotos f WHERE f.id_producto = p.id_producto AND f.es_de_medidas = 0 ORDER BY f.orden, f.id_foto LIMIT 1) AS foto_principal
    FROM productos p
    JOIN categorias c ON c.id_categoria = p.id_categoria
    LEFT JOIN categorias cp ON cp.id_categoria = c.id_categoria_padre
    JOIN materiales m ON m.id_material = p.id_material`;

// Quita el stock y deja solo la disponibilidad.
function aPublico(producto, umbral) {
  const { stock, ...resto } = producto;
  return { ...resto, es_hipoalergenico: resto.es_hipoalergenico === 1, disponibilidad: configuracionModel.disponibilidad(stock, umbral) };
}

// GET /api/catalogo
export async function listarCatalogo(req, res, next) {
  try {
    const { umbral_pocas_unidades: umbral } = await configuracionModel.obtenerValores();
    const [filas] = await pool.query(`${SELECT_CATALOGO} ORDER BY p.nombre`);
    res.status(200).json(filas.map((p) => aPublico(p, umbral)));
  } catch (error) {
    next(error);
  }
}

// GET /api/catalogo/filtros
export async function obtenerFiltros(req, res, next) {
  try {
    const [categorias] = await pool.query('SELECT id_categoria, nombre, descripcion, id_categoria_padre FROM categorias ORDER BY nombre');
    const [materiales] = await pool.query('SELECT id_material, nombre, es_hipoalergenico FROM materiales ORDER BY nombre');
    const valores = await configuracionModel.obtenerValores();
    res.status(200).json({
      categorias,
      materiales: materiales.map((m) => ({ ...m, es_hipoalergenico: m.es_hipoalergenico === 1 })),
      mensaje_catalogo: valores.mensaje_catalogo
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/catalogo/:id
export async function obtenerProductoCatalogo(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const [filas] = await pool.execute(`${SELECT_CATALOGO} WHERE p.id_producto = ?`, [id]);
    if (filas.length === 0) throw new ErrorHttp(404, 'El producto no existe.');
    const { umbral_pocas_unidades: umbral } = await configuracionModel.obtenerValores();
    const fotos = await fotoModel.listarPorProducto(id);
    res.status(200).json({
      ...aPublico(filas[0], umbral),
      fotos: fotos.map((f) => f.archivo), // las de medidas siempre van al final
      fotos_medidas: fotos.filter((f) => f.es_de_medidas).map((f) => f.archivo)
    });
  } catch (error) {
    next(error);
  }
}
