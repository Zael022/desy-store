// Llamadas a la API de proveedores.
import { api } from './api.js';

const RUTA = '/proveedores';

export const listarProveedores = () => api.obtener(RUTA);
export const obtenerProveedor = (id) => api.obtener(`${RUTA}/${id}`);
export const crearProveedor = (datos) => api.crear(RUTA, datos);
export const actualizarProveedor = (id, datos) => api.actualizar(`${RUTA}/${id}`, datos);
export const eliminarProveedor = (id) => api.eliminar(`${RUTA}/${id}`);
