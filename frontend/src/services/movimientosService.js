// Llamadas a la API de movimientos de inventario (entradas y salidas).
import { api } from './api.js';

const RUTA = '/movimientos';

export const listarMovimientos = () => api.obtener(RUTA);
export const obtenerMovimiento = (id) => api.obtener(`${RUTA}/${id}`);
export const crearMovimiento = (datos) => api.crear(RUTA, datos);
export const actualizarMovimiento = (id, datos) => api.actualizar(`${RUTA}/${id}`, datos);
export const eliminarMovimiento = (id) => api.eliminar(`${RUTA}/${id}`);
