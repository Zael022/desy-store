// Modelo de sesiones y desafíos MFA.
// La cookie lleva un token aleatorio; la base guarda solo su hash SHA-256.
// Analogía: la cookie es la pulsera de un concierto; la base anota la "huella"
// de cada pulsera válida. Si alguien copia la lista de huellas, no obtiene pulseras.
import pool from '../config/db.js';
import { configuracion } from '../config/env.js';
import { generarToken, hashToken } from '../servicios/cripto.js';

// Datos del usuario que el resto del backend necesita (siempre desde la base, nunca desde el navegador).
const SELECT_USUARIO_DE_SESION = `
  SELECT u.id_usuario, u.correo, u.rol, u.id_empleado, u.id_proveedor, u.telefono,
         u.correo_verificado, u.telefono_verificado, c.id_cliente,
         COALESCE(c.nombre, e.nombre, p.nombre) AS nombre`;
const JOINS_USUARIO = `
    JOIN usuarios u ON u.id_usuario = s.id_usuario
    LEFT JOIN clientes c ON c.id_usuario = u.id_usuario
    LEFT JOIN empleados e ON e.id_empleado = u.id_empleado
    LEFT JOIN proveedores p ON p.id_proveedor = u.id_proveedor`;

// ---------- Sesiones ----------

export async function crearSesion(conexion, { idUsuario, ip, agente }) {
  const token = generarToken();
  await conexion.execute(
    `INSERT INTO sesiones (id_usuario, hash_token, expira_absoluta, ip, agente)
     VALUES (?, ?, NOW() + INTERVAL ? HOUR, ?, ?)`,
    [idUsuario, hashToken(token), configuracion.seguridad.sesionAbsolutaHoras, ip, agente ? String(agente).slice(0, 255) : null]
  );
  return token;
}

// Devuelve el usuario de una sesión válida, o null si no existe, venció o está revocada.
// Una sesión es válida si: no está revocada, la cuenta sigue activa, no pasó el
// límite absoluto (8 horas) y hubo actividad en los últimos 30 minutos.
export async function buscarUsuarioDeSesion(token) {
  const [filas] = await pool.execute(
    `${SELECT_USUARIO_DE_SESION}, s.id_sesion
       FROM sesiones s
       ${JOINS_USUARIO}
      WHERE s.hash_token = ?
        AND s.revocada = 0
        AND u.activo = 1
        AND s.expira_absoluta > NOW()
        AND s.ultima_actividad > NOW() - INTERVAL ? MINUTE`,
    [hashToken(token), configuracion.seguridad.sesionInactividadMinutos]
  );
  if (filas.length === 0) return null;
  // Cada petición cuenta como actividad: así la sesión no vence mientras se usa.
  await pool.execute('UPDATE sesiones SET ultima_actividad = NOW() WHERE id_sesion = ?', [filas[0].id_sesion]);
  return filas[0];
}

export async function revocarSesion(idSesion) {
  await pool.execute('UPDATE sesiones SET revocada = 1 WHERE id_sesion = ?', [idSesion]);
}

// Cierra todas las sesiones de un usuario (menos una, si se indica).
export async function revocarSesionesDeUsuario(idUsuario, { excepto = null, conexion = pool } = {}) {
  if (excepto) {
    await conexion.execute('UPDATE sesiones SET revocada = 1 WHERE id_usuario = ? AND revocada = 0 AND id_sesion <> ?', [idUsuario, excepto]);
  } else {
    await conexion.execute('UPDATE sesiones SET revocada = 1 WHERE id_usuario = ? AND revocada = 0', [idUsuario]);
  }
}

export async function listarSesionesActivas(idUsuario) {
  const [filas] = await pool.execute(
    `SELECT id_sesion, creada_en, ultima_actividad, expira_absoluta, ip, agente
       FROM sesiones
      WHERE id_usuario = ? AND revocada = 0 AND expira_absoluta > NOW()
        AND ultima_actividad > NOW() - INTERVAL ? MINUTE
      ORDER BY ultima_actividad DESC`,
    [idUsuario, configuracion.seguridad.sesionInactividadMinutos]
  );
  return filas;
}

// ---------- Desafíos MFA ----------

export const MINUTOS_DESAFIO = 5;

export async function crearDesafio({ idUsuario, ip }) {
  const token = generarToken();
  // Un desafío nuevo reemplaza a los anteriores del mismo usuario.
  await pool.execute('UPDATE desafios_mfa SET usado = 1 WHERE id_usuario = ? AND usado = 0', [idUsuario]);
  await pool.execute(
    'INSERT INTO desafios_mfa (id_usuario, hash_token, expira_en, ip) VALUES (?, ?, NOW() + INTERVAL ? MINUTE, ?)',
    [idUsuario, hashToken(token), MINUTOS_DESAFIO, ip]
  );
  return token;
}

// Desafío vigente con los datos del usuario (correo y teléfono verificados para elegir canal).
export async function buscarDesafio(token) {
  const [filas] = await pool.execute(
    `SELECT d.id_desafio, u.id_usuario, u.correo, u.rol, u.telefono, u.correo_verificado, u.telefono_verificado
       FROM desafios_mfa d
       JOIN usuarios u ON u.id_usuario = d.id_usuario
      WHERE d.hash_token = ? AND d.usado = 0 AND d.expira_en > NOW() AND u.activo = 1`,
    [hashToken(token)]
  );
  return filas[0] || null;
}

export async function marcarDesafioUsado(conexion, idDesafio) {
  await conexion.execute('UPDATE desafios_mfa SET usado = 1 WHERE id_desafio = ?', [idDesafio]);
}

// Datos que el frontend necesita del usuario de una sesión.
export async function datosPublicosDeUsuario(idUsuario) {
  const [filas] = await pool.execute(
    `SELECT u.id_usuario, u.correo, u.rol, u.telefono, u.correo_verificado, u.telefono_verificado,
            COALESCE(c.nombre, e.nombre, p.nombre) AS nombre
       FROM usuarios u
       LEFT JOIN clientes c ON c.id_usuario = u.id_usuario
       LEFT JOIN empleados e ON e.id_empleado = u.id_empleado
       LEFT JOIN proveedores p ON p.id_proveedor = u.id_proveedor
      WHERE u.id_usuario = ?`,
    [idUsuario]
  );
  const u = filas[0];
  return u
    ? { id_usuario: u.id_usuario, nombre: u.nombre, correo: u.correo, rol: u.rol, telefono: u.telefono, correo_verificado: u.correo_verificado === 1, telefono_verificado: u.telefono_verificado === 1 }
    : null;
}
