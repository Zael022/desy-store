// Auditoría: deja constancia de las acciones sensibles (quién, qué, cuándo e IP).
// Nunca se guardan contraseñas, códigos ni tokens: solo una descripción.
// Analogía: es el libro de visitas de la bodega, donde queda anotado quién entró y qué hizo.
import pool from '../config/db.js';

const LARGO_MAXIMO = 500;

// conexion (opcional): si la acción ocurre dentro de una transacción (por ejemplo una venta),
// se anota en la misma transacción para que se guarde o se deshaga junto con ella.
export async function registrarAuditoria({ idUsuario = null, accion, detalle = null, ip = null }, conexion = null) {
  const texto = detalle === null ? null : String(detalle).slice(0, LARGO_MAXIMO);
  const sql = 'INSERT INTO auditoria (id_usuario, accion, detalle, ip) VALUES (?, ?, ?, ?)';
  try {
    await (conexion ?? pool).execute(sql, [idUsuario, accion, texto, ip]);
  } catch (error) {
    // Si falla dentro de una transacción, el error debe subir para revertir todo.
    if (conexion) throw error;
    console.error('[Auditoría] No se pudo registrar:', accion, error.message);
  }
}

// IP de la petición (Express la entrega en req.ip).
export function ipDe(req) {
  return (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '').slice(0, 45) || null;
}
