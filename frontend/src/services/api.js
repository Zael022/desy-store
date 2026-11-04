// Único lugar donde el frontend habla con el backend.
// Los demás services solo dicen "a qué ruta" y "con qué datos".
// Así la URL de la API y la lógica de conexión no se repiten en ningún componente.

// La dirección viene del archivo .env (VITE_API_URL).
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Hace una petición y devuelve los datos ya convertidos de JSON.
// Si el backend responde con error, lanza un Error con su "message".
async function peticion(ruta, metodo = 'GET', datos) {
  const opciones = { method: metodo, headers: {} };
  if (datos !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(datos);
  }

  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, opciones);
  } catch {
    // fetch solo falla así cuando no hay conexión con el servidor.
    const error = new Error('No se pudo conectar con el servidor. Revise que el backend esté encendido.');
    error.esDeConexion = true;
    throw error;
  }

  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null; // la respuesta no traía JSON
  }

  if (!respuesta.ok) {
    throw new Error(cuerpo?.message || `El servidor respondió con el error ${respuesta.status}.`);
  }
  return cuerpo;
}

export const api = {
  obtener: (ruta) => peticion(ruta, 'GET'),
  crear: (ruta, datos) => peticion(ruta, 'POST', datos),
  actualizar: (ruta, datos) => peticion(ruta, 'PUT', datos),
  eliminar: (ruta) => peticion(ruta, 'DELETE')
};
