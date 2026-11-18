// Límites de peticiones por IP (express-rate-limit), para frenar a quien
// intenta adivinar contraseñas o pedir códigos sin parar.
// Además, el login bloquea temporalmente cada CUENTA tras 5 intentos fallidos
// (eso está en controllers/authController.js).
import { rateLimit } from 'express-rate-limit';
import { configuracion } from '../config/env.js';

// En las pruebas automáticas (NODE_ENV=test) todas las peticiones vienen de la
// misma IP, por eso allí el límite por IP es alto y se ignora el valor del .env.
// El bloqueo por CUENTA (5 intentos) sí se prueba y no depende de esto.
const numero = (nombre, porDefecto) => (configuracion.esPrueba ? 10000 : Number(process.env[nombre]) || porDefecto);

function crearLimite({ minutos, maximo, mensaje }) {
  return rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: maximo,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ message: mensaje })
  });
}

export const limiteLogin = crearLimite({
  minutos: 15,
  maximo: numero('LIMITE_LOGIN_POR_IP', 20),
  mensaje: 'Demasiados intentos de inicio de sesión desde esta conexión. Espere 15 minutos.'
});

export const limiteCodigos = crearLimite({
  minutos: 15,
  maximo: numero('LIMITE_CODIGOS_POR_IP', 15),
  mensaje: 'Demasiadas solicitudes de códigos desde esta conexión. Espere unos minutos.'
});

export const limiteRecuperacion = crearLimite({
  minutos: 60,
  maximo: numero('LIMITE_RECUPERACION_POR_IP', 10),
  mensaje: 'Demasiadas solicitudes de recuperación desde esta conexión. Intente más tarde.'
});

// Enlaces de un solo uso (restablecer contraseña e invitaciones). Los tokens son
// imposibles de adivinar; este límite solo frena el abuso.
export const limiteEnlaces = crearLimite({
  minutos: 15,
  maximo: numero('LIMITE_ENLACES_POR_IP', 40),
  mensaje: 'Demasiados intentos con enlaces desde esta conexión. Espere 15 minutos.'
});
