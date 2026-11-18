// Rutas de autenticación (/api/auth/...). Quién puede usar cada una está en config/permisos.js.
import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { limiteLogin, limiteCodigos, limiteRecuperacion, limiteEnlaces } from '../middleware/limites.js';

const router = Router();

router.get('/csrf', auth.obtenerCsrf);
router.post('/registro', limiteCodigos, auth.registrar);
router.post('/verificar-correo', limiteCodigos, auth.verificarCorreo);
router.post('/verificar-correo/reenviar', limiteCodigos, auth.reenviarVerificacion);
router.post('/login', limiteLogin, auth.iniciarSesion);
router.get('/mfa/canales', auth.obtenerCanales);
router.post('/mfa/enviar', limiteCodigos, auth.enviarCodigoMfa);
router.post('/mfa/verificar', limiteCodigos, auth.verificarCodigoMfa);
router.post('/logout', auth.cerrarSesion);
router.get('/sesion', auth.obtenerSesion);
router.post('/recuperar', limiteRecuperacion, auth.pedirRecuperacion);
router.post('/restablecer', limiteEnlaces, auth.restablecerContrasena);
router.post('/invitacion/validar', limiteEnlaces, auth.validarInvitacion);
router.post('/invitacion/aceptar', limiteEnlaces, auth.aceptarInvitacion);

export default router;
