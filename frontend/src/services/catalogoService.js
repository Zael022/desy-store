// Catálogo público (sin stock exacto, sin costos y sin proveedores).
import { api } from './api.js';

export const listarCatalogo = () => api.obtener('/catalogo');
export const obtenerFiltrosCatalogo = () => api.obtener('/catalogo/filtros');
export const obtenerProductoCatalogo = (id) => api.obtener(`/catalogo/${id}`);
