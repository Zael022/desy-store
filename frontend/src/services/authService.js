// Llamadas de autenticación: registro, login con MFA, recuperación e invitaciones.
import { api } from './api.js';

export const registrar = (datos) => api.crear('/auth/registro', datos);
export const verificarCorreo = (correo, codigo) => api.crear('/auth/verificar-correo', { correo, codigo });
export const reenviarVerificacion = (correo) => api.crear('/auth/verificar-correo/reenviar', { correo });

export const iniciarSesion = (correo, contrasena) => api.crear('/auth/login', { correo, contrasena });
export const obtenerCanalesMfa = () => api.obtener('/auth/mfa/canales');
export const enviarCodigoMfa = (canal) => api.crear('/auth/mfa/enviar', { canal });
export const verificarCodigoMfa = (codigo) => api.crear('/auth/mfa/verificar', { codigo });

export const cerrarSesion = () => api.crear('/auth/logout');
export const obtenerSesion = () => api.obtener('/auth/sesion', { silencioso401: true });

export const pedirRecuperacion = (correo) => api.crear('/auth/recuperar', { correo });
export const restablecerContrasena = (token, contrasena) => api.crear('/auth/restablecer', { token, contrasena });
export const validarInvitacion = (token) => api.crear('/auth/invitacion/validar', { token });
export const aceptarInvitacion = (token, contrasena) => api.crear('/auth/invitacion/aceptar', { token, contrasena });
