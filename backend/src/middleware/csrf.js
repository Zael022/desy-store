// Protección CSRF (falsificación de peticiones entre sitios).
//
// Analogía: CSRF es como si otra página web llenara un formulario a su nombre
// mientras usted tiene la sesión abierta, porque el navegador envía sus cookies
// automáticamente. La defensa es pedir además una "contraseña de formulario"
// (el token CSRF) que solo esta aplicación conoce.
//
// Patrón usado ("doble envío"):
//   1. GET /api/auth/csrf guarda un token en la cookie desy_csrf (HttpOnly) y lo devuelve en JSON.
//   2. El frontend envía ese token en la cabecera X-CSRF-Token en cada POST, PUT, PATCH y DELETE.
//   3. Aquí se comprueba que la cabecera y la cookie coincidan.
// Otra página no puede leer la respuesta de /api/auth/csrf (lo impide CORS),
// así que no puede saber el token. SameSite=Lax es una segunda barrera.
import { generarToken, hashToken, sonIguales } from '../servicios/cripto.js';
import { ErrorHttp } from './errores.js';
import { COOKIES, opcionesCookie } from './sesion.js';

const METODOS_QUE_CAMBIAN_DATOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function verificarCsrf(req, res, next) {
  if (!METODOS_QUE_CAMBIAN_DATOS.has(req.method)) return next();
  const deLaCookie = req.cookies?.[COOKIES.csrf];
  const deLaCabecera = req.get('x-csrf-token');
  if (!deLaCookie || !deLaCabecera || !sonIguales(hashToken(deLaCookie), hashToken(deLaCabecera))) {
    return next(new ErrorHttp(403, 'Falta el token de seguridad (CSRF) o no es válido. Recargue la página e intente de nuevo.'));
  }
  next();
}

// Crea un token nuevo y lo guarda en la cookie. Devuelve el token para enviarlo en JSON.
export function emitirTokenCsrf(res) {
  const token = generarToken();
  res.cookie(COOKIES.csrf, token, opcionesCookie());
  return token;
}
