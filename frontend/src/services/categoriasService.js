// Llamadas a la API de categorías.
import { api } from './api.js';

const RUTA = '/categorias';

export const listarCategorias = () => api.obtener(RUTA);
export const obtenerCategoria = (id) => api.obtener(`${RUTA}/${id}`);
export const crearCategoria = (datos) => api.crear(RUTA, datos);
export const actualizarCategoria = (id, datos) => api.actualizar(`${RUTA}/${id}`, datos);
export const eliminarCategoria = (id) => api.eliminar(`${RUTA}/${id}`);
