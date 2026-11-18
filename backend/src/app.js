// Configuración de Express: aquí se arma la "recepción" de la API.
// El orden importa. Cada petición pasa por estos filtros, de arriba hacia abajo:
//   1. helmet        -> cabeceras de seguridad del navegador.
//   2. cors          -> solo el frontend (CORS_ORIGIN) puede llamar a la API, con cookies.
//   3. cookieParser  -> lee las cookies (sesión, desafío MFA y CSRF).
//   4. express.json  -> convierte el cuerpo JSON en req.body.
//   5. cargarSesion  -> si hay cookie de sesión válida, deja el usuario en req.usuario.
//   6. autorizar     -> aplica la matriz de permisos (401 / 403 / 404).
//   7. verificarCsrf -> en POST, PUT, PATCH y DELETE exige el token CSRF.
//   8. rutas, 404 y errores.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { configuracion } from './config/env.js';
import rutas from './routes/index.js';
import { rutaNoEncontrada, manejadorErrores } from './middleware/errores.js';
import { cargarSesion } from './middleware/sesion.js';
import { autorizar } from './middleware/autorizacion.js';
import { verificarCsrf } from './middleware/csrf.js';

const app = express();

// Si la API está detrás de un proxy (por ejemplo, al publicarla), así req.ip es la IP real.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.disable('x-powered-by');

app.use(helmet());

// credentials: true permite que el navegador envíe las cookies, pero SOLO desde este origen.
app.use(cors({ origin: configuracion.corsOrigen, credentials: true }));

app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

// Las respuestas de la API no se guardan en caché (tienen datos privados).
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(cargarSesion);
app.use(autorizar);
app.use(verificarCsrf);

// Todas las rutas empiezan con /api (por ejemplo /api/productos).
app.use('/api', rutas);

// Si ninguna ruta respondió: 404 en JSON.
app.use(rutaNoEncontrada);

// Manejo centralizado de errores (siempre en JSON).
app.use(manejadorErrores);

export default app;
