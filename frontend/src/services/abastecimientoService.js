// Solicitudes de abastecimiento (administración y dueña).
import { api, consulta } from './api.js';

export const listarSolicitudes = (filtros) => api.obtener(`/abastecimiento${consulta(filtros)}`);
export const obtenerSolicitud = (id) => api.obtener(`/abastecimiento/${id}`);
export const crearSolicitud = (datos) => api.crear('/abastecimiento', datos);
export const recibirSolicitud = (id) => api.parchar(`/abastecimiento/${id}/recibir`);
export const cancelarSolicitud = (id) => api.parchar(`/abastecimiento/${id}/cancelar`);
