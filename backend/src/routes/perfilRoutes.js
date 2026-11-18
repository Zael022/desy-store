// Rutas del perfil propio (/api/perfil/...).
import { Router } from 'express';
import * as perfil from '../controllers/perfilController.js';
import { limiteCodigos, limiteLogin } from '../middleware/limites.js';

const router = Router();

router.get('/', perfil.obtenerPerfil);
router.put('/datos', perfil.actualizarDatos);
router.put('/contrasena', limiteLogin, perfil.cambiarContrasena);
router.post('/correo', limiteCodigos, perfil.pedirCambioCorreo);
router.post('/correo/confirmar', limiteCodigos, perfil.confirmarCambioCorreo);
router.post('/telefono', limiteCodigos, perfil.pedirVerificacionTelefono);
router.post('/telefono/confirmar', limiteCodigos, perfil.confirmarTelefono);
router.get('/sesiones', perfil.listarSesiones);
router.post('/sesiones/cerrar-otras', perfil.cerrarOtrasSesiones);

export default router;
