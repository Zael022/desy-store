// Gestión de cuentas (administración y dueña).
import { api } from './api.js';

export const listarUsuarios = () => api.obtener('/usuarios');
export const invitarUsuario = (datos) => api.crear('/usuarios/invitaciones', datos);
export const reenviarInvitacion = (id) => api.crear(`/usuarios/${id}/invitacion`);
export const cambiarEstadoUsuario = (id, activo) => api.parchar(`/usuarios/${id}/estado`, { activo });
export const cambiarRolUsuario = (id, rol) => api.parchar(`/usuarios/${id}/rol`, { rol });
export const corregirCorreoUsuario = (id, correo) => api.parchar(`/usuarios/${id}/correo`, { correo });
