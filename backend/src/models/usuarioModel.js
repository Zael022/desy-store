// Modelo de usuarios (cuentas para entrar al sistema).
// Una cuenta NO repite los datos de la persona: un cliente tiene su fila en
// "clientes", una cuenta interna apunta a su fila de "empleados" y una cuenta
// de proveedor apunta a su fila de "proveedores".
//
// Importante: ninguna función que devuelva datos hacia el frontend incluye
// hash_contrasena. El hash solo se lee en buscarParaLogin() y obtenerHash().
import pool from '../config/db.js';

const NOMBRE = 'COALESCE(c.nombre, e.nombre, p.nombre)';
const JOINS = `
    LEFT JOIN clientes c ON c.id_usuario = u.id_usuario
    LEFT JOIN empleados e ON e.id_empleado = u.id_empleado
    LEFT JOIN proveedores p ON p.id_proveedor = u.id_proveedor`;

// Columnas seguras para listas (sin hash).
const COLUMNAS_PUBLICAS = `
  u.id_usuario, u.correo, u.rol, u.activo, u.correo_verificado, u.telefono, u.telefono_verificado,
  u.id_empleado, u.id_proveedor, c.id_cliente, ${NOMBRE} AS nombre,
  e.nombre AS nombre_empleado, p.nombre AS nombre_proveedor,
  (u.hash_contrasena IS NOT NULL) AS tiene_contrasena,
  u.creado_en, u.ultimo_acceso`;

// Para el login: incluye el hash y el estado de bloqueo.
export async function buscarParaLogin(correo) {
  const [filas] = await pool.execute(
    `SELECT u.id_usuario, u.correo, u.rol, u.activo, u.hash_contrasena, u.correo_verificado,
            u.telefono, u.telefono_verificado, u.intentos_fallidos,
            (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS bloqueado
       FROM usuarios u
      WHERE u.correo = ?`,
    [correo]
  );
  return filas[0] || null;
}

export async function obtenerHash(idUsuario) {
  const [filas] = await pool.execute('SELECT hash_contrasena FROM usuarios WHERE id_usuario = ?', [idUsuario]);
  return filas[0]?.hash_contrasena ?? null;
}

export async function obtenerPorId(idUsuario, conexion = pool) {
  const [filas] = await conexion.execute(`SELECT ${COLUMNAS_PUBLICAS} FROM usuarios u ${JOINS} WHERE u.id_usuario = ?`, [idUsuario]);
  return filas[0] || null;
}

export async function obtenerPorCorreo(correo, conexion = pool) {
  const [filas] = await conexion.execute(`SELECT ${COLUMNAS_PUBLICAS} FROM usuarios u ${JOINS} WHERE u.correo = ?`, [correo]);
  return filas[0] || null;
}

export async function listar() {
  const [filas] = await pool.query(`SELECT ${COLUMNAS_PUBLICAS} FROM usuarios u ${JOINS} ORDER BY FIELD(u.rol, 'duena', 'administrador', 'ventas', 'proveedor', 'cliente'), nombre`);
  return filas.map((fila) => ({ ...fila, tiene_contrasena: fila.tiene_contrasena === 1 }));
}

// ---------- Intentos fallidos y bloqueo temporal ----------

export const INTENTOS_ANTES_DE_BLOQUEAR = 5;
export const MINUTOS_DE_BLOQUEO = 15;

// Suma un intento fallido. Al llegar a 5, bloquea la cuenta 15 minutos y reinicia el contador.
// Devuelve true si la cuenta quedó bloqueada.
export async function registrarIntentoFallido(idUsuario) {
  await pool.execute(
    `UPDATE usuarios
        SET intentos_fallidos = intentos_fallidos + 1
      WHERE id_usuario = ?`,
    [idUsuario]
  );
  const [resultado] = await pool.execute(
    `UPDATE usuarios
        SET bloqueado_hasta = NOW() + INTERVAL ? MINUTE, intentos_fallidos = 0
      WHERE id_usuario = ? AND intentos_fallidos >= ?`,
    [MINUTOS_DE_BLOQUEO, idUsuario, INTENTOS_ANTES_DE_BLOQUEAR]
  );
  return resultado.affectedRows > 0;
}

export async function reiniciarIntentos(idUsuario, conexion = pool) {
  await conexion.execute('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = ?', [idUsuario]);
}

// ---------- Creación ----------

// Cliente nuevo (registro público): siempre rol "cliente".
export async function crearCliente(conexion, { correo, hash, nombre, telefono }) {
  const [resultado] = await conexion.execute(
    `INSERT INTO usuarios (correo, hash_contrasena, rol, telefono) VALUES (?, ?, 'cliente', ?)`,
    [correo, hash, telefono]
  );
  await conexion.execute('INSERT INTO clientes (id_usuario, nombre) VALUES (?, ?)', [resultado.insertId, nombre]);
  return resultado.insertId;
}

// Cuenta creada por el personal (sin contraseña: la define la persona con la invitación).
export async function crearInvitado(conexion, { correo, rol, idEmpleado = null, idProveedor = null }) {
  const [resultado] = await conexion.execute(
    'INSERT INTO usuarios (correo, rol, id_empleado, id_proveedor) VALUES (?, ?, ?, ?)',
    [correo, rol, idEmpleado, idProveedor]
  );
  return resultado.insertId;
}

// ---------- Cambios ----------

export async function guardarContrasena(conexion, idUsuario, hash) {
  await conexion.execute(
    'UPDATE usuarios SET hash_contrasena = ?, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = ?',
    [hash, idUsuario]
  );
}

export async function marcarCorreoVerificado(conexion, idUsuario) {
  await conexion.execute('UPDATE usuarios SET correo_verificado = 1 WHERE id_usuario = ?', [idUsuario]);
}

export async function cambiarCorreo(conexion, idUsuario, correo) {
  await conexion.execute('UPDATE usuarios SET correo = ?, correo_verificado = 1 WHERE id_usuario = ?', [correo, idUsuario]);
}

export async function guardarTelefonoVerificado(conexion, idUsuario, telefono) {
  await conexion.execute('UPDATE usuarios SET telefono = ?, telefono_verificado = 1 WHERE id_usuario = ?', [telefono, idUsuario]);
}

export async function registrarAcceso(conexion, idUsuario) {
  await conexion.execute('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?', [idUsuario]);
}

export async function cambiarEstado(conexion, idUsuario, activo) {
  await conexion.execute('UPDATE usuarios SET activo = ? WHERE id_usuario = ?', [activo ? 1 : 0, idUsuario]);
}

export async function cambiarRol(conexion, idUsuario, rol) {
  await conexion.execute('UPDATE usuarios SET rol = ? WHERE id_usuario = ?', [rol, idUsuario]);
}

export async function contarDuenasActivas(conexion = pool) {
  const [filas] = await conexion.execute("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'duena' AND activo = 1");
  return filas[0].total;
}

// ---------- Datos del cliente ----------

export async function obtenerCliente(idUsuario) {
  const [filas] = await pool.execute('SELECT id_cliente, nombre, direccion FROM clientes WHERE id_usuario = ?', [idUsuario]);
  return filas[0] || null;
}

export async function actualizarCliente(idUsuario, { nombre, direccion }) {
  await pool.execute('UPDATE clientes SET nombre = ?, direccion = ? WHERE id_usuario = ?', [nombre, direccion, idUsuario]);
}

// Búsqueda de clientes para el punto de venta (nombre o correo).
export async function buscarClientes(texto) {
  const patron = `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const [filas] = await pool.execute(
    `SELECT c.id_cliente, c.nombre, u.correo
       FROM clientes c
       JOIN usuarios u ON u.id_usuario = c.id_usuario
      WHERE u.activo = 1 AND (c.nombre LIKE ? OR u.correo LIKE ?)
      ORDER BY c.nombre
      LIMIT 10`,
    [patron, patron]
  );
  return filas;
}

export async function existeCliente(idCliente) {
  const [filas] = await pool.execute(
    'SELECT c.id_cliente FROM clientes c JOIN usuarios u ON u.id_usuario = c.id_usuario WHERE c.id_cliente = ? AND u.activo = 1',
    [idCliente]
  );
  return filas.length > 0;
}

// ---------- Enlaces de un solo uso (recuperación e invitación) ----------

// Crea un enlace nuevo y anula los anteriores del mismo propósito.
export async function crearEnlace(conexion, { idUsuario, proposito, hashToken, minutos, idCreador = null }) {
  await conexion.execute(
    'UPDATE recuperacion_contrasena SET usado = 1 WHERE id_usuario = ? AND proposito = ? AND usado = 0',
    [idUsuario, proposito]
  );
  await conexion.execute(
    `INSERT INTO recuperacion_contrasena (id_usuario, proposito, hash_token, expira_en, id_usuario_creador)
     VALUES (?, ?, ?, NOW() + INTERVAL ? MINUTE, ?)`,
    [idUsuario, proposito, hashToken, minutos, idCreador]
  );
}

// Enlaces de recuperación pedidos en la última hora (para limitar a 3 por cuenta).
export async function contarEnlacesRecientes(idUsuario, proposito) {
  const [filas] = await pool.execute(
    'SELECT COUNT(*) AS total FROM recuperacion_contrasena WHERE id_usuario = ? AND proposito = ? AND creado_en > NOW() - INTERVAL 1 HOUR',
    [idUsuario, proposito]
  );
  return filas[0].total;
}

// Busca un enlace vigente (no usado y no vencido). Con conexion bloquea la fila.
export async function buscarEnlace(hashToken, proposito, conexion = null) {
  const [filas] = await (conexion ?? pool).execute(
    `SELECT r.id_recuperacion, r.id_usuario, u.correo, u.rol, u.activo, ${NOMBRE} AS nombre
       FROM recuperacion_contrasena r
       JOIN usuarios u ON u.id_usuario = r.id_usuario
       ${JOINS}
      WHERE r.hash_token = ? AND r.proposito = ? AND r.usado = 0 AND r.expira_en > NOW()
      ${conexion ? 'FOR UPDATE' : ''}`,
    [hashToken, proposito]
  );
  return filas[0] || null;
}

export async function marcarEnlaceUsado(conexion, idRecuperacion) {
  await conexion.execute('UPDATE recuperacion_contrasena SET usado = 1 WHERE id_recuperacion = ?', [idRecuperacion]);
}

export async function anularEnlaces(conexion, idUsuario) {
  await conexion.execute('UPDATE recuperacion_contrasena SET usado = 1 WHERE id_usuario = ? AND usado = 0', [idUsuario]);
}
