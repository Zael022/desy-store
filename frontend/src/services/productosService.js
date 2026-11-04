// Llamadas a la API de productos.
import { api } from './api.js';

const RUTA = '/productos';

export const listarProductos = () => api.obtener(RUTA);
export const obtenerProducto = (id) => api.obtener(`${RUTA}/${id}`);
export const crearProducto = (datos) => api.crear(RUTA, datos);
export const actualizarProducto = (id, datos) => api.actualizar(`${RUTA}/${id}`, datos);
export const eliminarProducto = (id) => api.eliminar(`${RUTA}/${id}`);
