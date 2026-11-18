// Perfil y seguridad de la cuenta propia.
import { api } from './api.js';

export const obtenerPerfil = () => api.obtener('/perfil');
export const actualizarDatos = (datos) => api.actualizar('/perfil/datos', datos);
export const cambiarContrasena = (actual, nueva) => api.actualizar('/perfil/contrasena', { actual, nueva });
export const pedirCambioCorreo = (correoNuevo, contrasena) => api.crear('/perfil/correo', { correo_nuevo: correoNuevo, contrasena });
export const confirmarCambioCorreo = (codigo) => api.crear('/perfil/correo/confirmar', { codigo });
export const pedirVerificacionTelefono = (telefono) => api.crear('/perfil/telefono', { telefono });
export const confirmarTelefono = (codigo) => api.crear('/perfil/telefono/confirmar', { codigo });
export const listarSesiones = () => api.obtener('/perfil/sesiones');
export const cerrarOtrasSesiones = () => api.crear('/perfil/sesiones/cerrar-otras');
