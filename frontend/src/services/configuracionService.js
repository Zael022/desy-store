// Configuración que el backend comparte con el frontend (por ejemplo, el stock máximo).
// El 67 NO está escrito en el frontend: se pide aquí a GET /api/configuracion.
import { api } from './api.js';

export const obtenerConfiguracion = () => api.obtener('/configuracion');
