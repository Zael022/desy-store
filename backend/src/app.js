// Configuración de Express: aquí se arma la "recepción" de la API.
// El orden importa: primero CORS y JSON, luego las rutas y al final los errores.
import express from 'express';
import cors from 'cors';
import { configuracion } from './config/env.js';
import rutas from './routes/index.js';
import { rutaNoEncontrada, manejadorErrores } from './middleware/errores.js';

const app = express();

// CORS: solo el frontend (la dirección de CORS_ORIGIN en .env) puede llamar a la API desde el navegador.
app.use(cors({ origin: configuracion.corsOrigen }));

// Convierte el cuerpo JSON de las peticiones en un objeto (req.body).
app.use(express.json({ limit: '100kb' }));

// Todas las rutas empiezan con /api (por ejemplo /api/productos).
app.use('/api', rutas);

// Si ninguna ruta respondió: 404 en JSON.
app.use(rutaNoEncontrada);

// Manejo centralizado de errores (siempre en JSON).
app.use(manejadorErrores);

export default app;
