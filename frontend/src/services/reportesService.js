// Reportes y auditoría.
import { api, consulta } from './api.js';

export const obtenerReporteOperativo = (filtros) => api.obtener(`/reportes/operativo${consulta(filtros)}`);
export const obtenerReporteEjecutivo = (filtros) => api.obtener(`/reportes/ejecutivo${consulta(filtros)}`);
export const listarAuditoria = (filtros) => api.obtener(`/auditoria${consulta(filtros)}`);
