// Único lugar donde el frontend habla con el backend.
// Los demás services solo dicen "a qué ruta" y "con qué datos".
//
// Seguridad (explicado simple):
//   * credentials: 'include' -> el navegador envía las cookies de sesión. Las
//     cookies son HttpOnly: este código NO puede leerlas (ni un script malicioso).
//   * Token CSRF: en cada POST, PUT, PATCH y DELETE se manda la cabecera
//     X-CSRF-Token. El token se pide a /api/auth/csrf y se guarda en memoria.
//   * Si el backend responde 401 (sesión vencida), se avisa a toda la app con el
//     evento "desy:sesion-expirada" para volver al login con un mensaje.
// No hay ningún secreto aquí: todo lo de este archivo lo puede ver cualquiera.

// En desarrollo, Vite reenvía /api al backend (ver vite.config.js), así el
// navegador ve todo como un solo sitio y las cookies funcionan sin problemas.
export const API_URL = import.meta.env.VITE_API_URL || '/api';
const METODOS_CON_CSRF = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const EVENTO_SESION_EXPIRADA = 'desy:sesion-expirada';

let tokenCsrf = null;
let pidiendoToken = null;

export function guardarTokenCsrf(token) {
  if (token) tokenCsrf = token;
}

async function obtenerTokenCsrf(forzar = false) {
  if (tokenCsrf && !forzar) return tokenCsrf;
  if (!pidiendoToken) {
    pidiendoToken = fetch(`${API_URL}/auth/csrf`, { credentials: 'include' })
      .then((r) => r.json())
      .then((datos) => {
        tokenCsrf = datos.csrfToken;
        return tokenCsrf;
      })
      .finally(() => {
        pidiendoToken = null;
      });
  }
  return pidiendoToken;
}

// Error con el código HTTP, para que las páginas puedan reaccionar (409, 429...).
export class ErrorApi extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

async function peticion(ruta, metodo = 'GET', datos, { reintento = false, silencioso401 = false } = {}) {
  const opciones = { method: metodo, headers: {}, credentials: 'include' };
  if (datos instanceof FormData) {
    // Fotos: el navegador arma el "multipart/form-data" (no se pone Content-Type a mano).
    opciones.body = datos;
  } else if (datos !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(datos);
  }

  let respuesta;
  try {
    if (METODOS_CON_CSRF.has(metodo)) opciones.headers['X-CSRF-Token'] = await obtenerTokenCsrf();
    respuesta = await fetch(`${API_URL}${ruta}`, opciones);
  } catch {
    // fetch solo falla así cuando no hay conexión con el servidor.
    const error = new ErrorApi('No se pudo conectar con el servidor. Revise que el backend esté encendido.', 0);
    error.esDeConexion = true;
    throw error;
  }

  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null; // la respuesta no traía JSON
  }

  // Nuestro backend SIEMPRE responde errores en JSON. Un 5xx sin JSON significa que
  // no contestó el backend sino el proxy de Vite (backend apagado o reiniciándose).
  if (!respuesta.ok && cuerpo === null && respuesta.status >= 500) {
    const error = new ErrorApi('No se pudo conectar con el servidor. Revise que el backend esté encendido.', 0);
    error.esDeConexion = true;
    throw error;
  }

  if (!respuesta.ok) {
    const mensaje = cuerpo?.message || `El servidor respondió con el error ${respuesta.status}.`;
    // El token CSRF pudo cambiar (por ejemplo, después de cerrar sesión): se pide otro y se reintenta una vez.
    if (respuesta.status === 403 && /CSRF/.test(mensaje) && !reintento) {
      await obtenerTokenCsrf(true);
      return peticion(ruta, metodo, datos, { reintento: true, silencioso401 });
    }
    if (respuesta.status === 401 && !silencioso401 && !ruta.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA, { detail: mensaje }));
    }
    throw new ErrorApi(mensaje, respuesta.status);
  }
  if (cuerpo?.csrfToken) guardarTokenCsrf(cuerpo.csrfToken); // el login y el logout entregan uno nuevo
  return cuerpo;
}

export const api = {
  obtener: (ruta, opciones) => peticion(ruta, 'GET', undefined, opciones),
  crear: (ruta, datos) => peticion(ruta, 'POST', datos ?? {}),
  actualizar: (ruta, datos) => peticion(ruta, 'PUT', datos),
  parchar: (ruta, datos) => peticion(ruta, 'PATCH', datos ?? {}),
  eliminar: (ruta) => peticion(ruta, 'DELETE')
};

// Dirección de la foto de un producto (la imagen la entrega GET /api/fotos/:archivo).
export function urlFoto(archivo) {
  return archivo ? `${API_URL}/fotos/${encodeURIComponent(archivo)}` : null;
}

// Arma "?desde=...&hasta=..." sin los valores vacíos.
export function consulta(parametros = {}) {
  const limpios = Object.entries(parametros).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '');
  return limpios.length ? `?${new URLSearchParams(limpios).toString()}` : '';
}
