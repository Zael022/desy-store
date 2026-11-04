// Controlador de configuración y salud de la API.
import pool from '../config/db.js';
import { STOCK_MINIMO, STOCK_MAXIMO } from '../config/constantes.js';

// GET /api/configuracion -> el frontend lee de aquí el stock máximo (67).
export function obtenerConfiguracion(req, res) {
  res.status(200).json({ stock_minimo: STOCK_MINIMO, stock_maximo: STOCK_MAXIMO });
}

// GET /api/salud -> sirve para comprobar que la API y MySQL responden.
export async function verificarSalud(req, res, next) {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ message: 'La API y la base de datos están funcionando.' });
  } catch (error) {
    next(error);
  }
}
