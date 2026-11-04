// Llamadas a la API de empleados.
import { api } from './api.js';

const RUTA = '/empleados';

export const listarEmpleados = () => api.obtener(RUTA);
export const obtenerEmpleado = (id) => api.obtener(`${RUTA}/${id}`);
export const crearEmpleado = (datos) => api.crear(RUTA, datos);
export const actualizarEmpleado = (id, datos) => api.actualizar(`${RUTA}/${id}`, datos);
export const eliminarEmpleado = (id) => api.eliminar(`${RUTA}/${id}`);
