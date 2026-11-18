// Llamadas a la API de productos.
import { api } from './api.js';

const RUTA = '/productos';

export const listarProductos = () => api.obtener(RUTA);
export const obtenerProducto = (id) => api.obtener(`${RUTA}/${id}`);
export const crearProducto = (datos) => api.crear(RUTA, datos);
export const actualizarProducto = (id, datos) => api.actualizar(`${RUTA}/${id}`, datos);
export const eliminarProducto = (id) => api.eliminar(`${RUTA}/${id}`);

// Fotos del producto (solo administración y dueña).
export const listarFotos = (id) => api.obtener(`${RUTA}/${id}/fotos`);
export function subirFoto(id, archivo, esDeMedidas = false) {
  const formulario = new FormData();
  formulario.append('es_de_medidas', esDeMedidas ? 'true' : 'false');
  formulario.append('foto', archivo);
  return api.crear(`${RUTA}/${id}/fotos`, formulario);
}
export const hacerFotoPrincipal = (id, idFoto) => api.parchar(`${RUTA}/${id}/fotos/${idFoto}/principal`);
// Las fotos con medidas nunca son la principal: el backend las deja siempre al final.
export const marcarFotoMedidas = (id, idFoto, esDeMedidas) => api.parchar(`${RUTA}/${id}/fotos/${idFoto}/medidas`, { es_de_medidas: esDeMedidas });
export const eliminarFoto = (id, idFoto) => api.eliminar(`${RUTA}/${id}/fotos/${idFoto}`);
