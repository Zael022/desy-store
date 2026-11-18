// Rutas de administración: usuarios, reportes, auditoría y configuración del sistema.
import { Router } from 'express';
import * as usuarios from '../controllers/usuarioController.js';
import * as reportes from '../controllers/reporteController.js';
import { obtenerConfiguracionSistema, actualizarConfiguracionSistema } from '../controllers/configuracionController.js';

export const usuariosRoutes = Router()
  .get('/', usuarios.listarUsuarios)
  .post('/invitaciones', usuarios.crearInvitacion)
  .post('/:id/invitacion', usuarios.reenviarInvitacion)
  .patch('/:id/correo', usuarios.cambiarCorreoInvitado)
  .patch('/:id/estado', usuarios.cambiarEstado)
  .patch('/:id/rol', usuarios.cambiarRol);

export const reportesRoutes = Router()
  .get('/operativo', reportes.reporteOperativo)
  .get('/ejecutivo', reportes.reporteEjecutivo);

export const auditoriaRoutes = Router().get('/', reportes.listarAuditoria);

export const configuracionSistemaRoutes = Router()
  .get('/', obtenerConfiguracionSistema)
  .put('/', actualizarConfiguracionSistema);
