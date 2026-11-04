// Llamadas a la API de materiales.
import { api } from './api.js';

const RUTA = '/materiales';

export const listarMateriales = () => api.obtener(RUTA);
export const obtenerMaterial = (id) => api.obtener(`${RUTA}/${id}`);
export const crearMaterial = (datos) => api.crear(RUTA, datos);
export const actualizarMaterial = (id, datos) => api.actualizar(`${RUTA}/${id}`, datos);
export const eliminarMaterial = (id) => api.eliminar(`${RUTA}/${id}`);
