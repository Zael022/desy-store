// Portal del proveedor (el backend toma el proveedor de la sesión).
import { api } from './api.js';

export const listarMisProductos = () => api.obtener('/portal-proveedor/productos');
export const obtenerMisDatos = () => api.obtener('/portal-proveedor/datos');
export const actualizarMisDatos = (datos) => api.actualizar('/portal-proveedor/datos', datos);
export const listarMisSolicitudes = () => api.obtener('/portal-proveedor/solicitudes');
export const obtenerMiSolicitud = (id) => api.obtener(`/portal-proveedor/solicitudes/${id}`);
export const responderSolicitud = (id, decision, comentario) => api.parchar(`/portal-proveedor/solicitudes/${id}/respuesta`, { decision, comentario });
