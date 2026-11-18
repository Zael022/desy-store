// El "portero" del backend: aplica la matriz de permisos (config/permisos.js)
// a TODAS las peticiones, antes de llegar a cualquier ruta.
//
// RBAC = control de acceso basado en roles. Analogía: en un hotel, la tarjeta
// de cada huésped abre solo ciertas puertas. Esconder un botón en React es
// como no poner el letrero de una puerta: la puerta igual tiene que estar cerrada.
import { buscarRegla } from '../config/permisos.js';
import { buscarDesafio } from '../models/sesionModel.js';
import { ErrorHttp } from './errores.js';
import { COOKIES } from './sesion.js';

export async function autorizar(req, res, next) {
  try {
    const regla = buscarRegla(req.method, req.path);
    if (!regla) {
      // Lo que no está en la matriz no existe.
      throw new ErrorHttp(404, `La ruta ${req.method} ${req.originalUrl} no existe.`);
    }
    req.regla = regla;

    if (regla.acceso === 'publico') return next();

    if (regla.acceso === 'desafio') {
      // Solo para los pasos del MFA: hace falta haber escrito bien la contraseña hace menos de 5 minutos.
      const token = req.cookies?.[COOKIES.desafio];
      req.desafio = token ? await buscarDesafio(token) : null;
      if (!req.desafio) {
        throw new ErrorHttp(401, 'El inicio de sesión venció o no empezó. Escriba su correo y contraseña de nuevo.');
      }
      return next();
    }

    // Rutas protegidas: hace falta una sesión completa (contraseña + código MFA).
    // Un usuario que solo pasó la contraseña tiene un desafío, no una sesión: aquí recibe 401.
    if (!req.usuario) {
      throw new ErrorHttp(401, req.sesionVencida ? 'Su sesión expiró. Inicie sesión de nuevo.' : 'Debe iniciar sesión para continuar.');
    }
    if (!regla.acceso.includes(req.usuario.rol)) {
      throw new ErrorHttp(403, 'No tiene permiso para hacer esto.');
    }
    next();
  } catch (error) {
    next(error);
  }
}
