// Cookies de seguridad y carga de la sesión en cada petición.
//
// Tres cookies, todas HttpOnly (JavaScript del navegador no puede leerlas),
// SameSite=Lax y Secure en producción (solo viajan por HTTPS):
//   desy_sesion -> sesión real (después del código MFA)
//   desy_mfa    -> desafío MFA de 5 minutos (solo se envía a /api/auth/mfa)
//   desy_csrf   -> token CSRF (ver middleware/csrf.js)
import { configuracion } from '../config/env.js';
import { buscarUsuarioDeSesion } from '../models/sesionModel.js';

export const COOKIES = { sesion: 'desy_sesion', desafio: 'desy_mfa', csrf: 'desy_csrf' };
export const RUTA_COOKIE_DESAFIO = '/api/auth/mfa';

export function opcionesCookie({ maxAgeMs, ruta = '/' } = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: configuracion.esProduccion,
    path: ruta,
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {})
  };
}

// Lee la cookie de sesión (si existe) y deja el usuario en req.usuario.
// No rechaza nada: quien decide si hace falta sesión es middleware/autorizacion.js.
export async function cargarSesion(req, res, next) {
  try {
    const token = req.cookies?.[COOKIES.sesion];
    req.usuario = null;
    if (token) {
      req.usuario = await buscarUsuarioDeSesion(token);
      if (!req.usuario) {
        // La cookie existía pero la sesión ya no sirve (venció, se cerró o la cuenta se desactivó).
        req.sesionVencida = true;
        res.clearCookie(COOKIES.sesion, opcionesCookie());
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}
