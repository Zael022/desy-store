// Configuración: la pública (stock máximo, umbral) y la del sistema (solo dueña la cambia).
import { api } from './api.js';

export const obtenerConfiguracion = () => api.obtener('/configuracion');
export const obtenerConfiguracionSistema = () => api.obtener('/configuracion/sistema');
export const actualizarConfiguracionSistema = (cambios) => api.actualizar('/configuracion/sistema', cambios);
