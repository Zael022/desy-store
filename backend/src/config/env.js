// Carga las variables del archivo .env en un solo lugar.
// Todo el backend lee la configuración desde aquí.
import dotenv from 'dotenv';

// quiet: true evita mensajes extra de dotenv en la consola.
dotenv.config({ quiet: true });

export const configuracion = {
  puerto: Number(process.env.PORT) || 3000,
  corsOrigen: process.env.CORS_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || 'localhost',
    puerto: Number(process.env.DB_PORT) || 3306,
    usuario: process.env.DB_USER || 'root',
    contrasena: process.env.DB_PASSWORD || '',
    nombre: process.env.DB_NAME || 'inventario_bisuteria'
  }
};
