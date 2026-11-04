// Constantes de negocio del sistema.
// Si la tienda decide cambiar el máximo de unidades por producto,
// SOLO hay que cambiar este número y reiniciar el backend.
// El frontend lo obtiene desde GET /api/configuracion, así que se actualiza solo.

export const STOCK_MINIMO = 0;
export const STOCK_MAXIMO = 67;

// Tipos de movimiento permitidos (deben coincidir con el ENUM de la tabla movimientos).
export const TIPOS_MOVIMIENTO = ['entrada', 'salida'];
