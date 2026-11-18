// Configuración general del sistema (tabla configuracion: clave -> valor).
// Solo la dueña puede cambiarla; administración puede verla.
import pool from '../config/db.js';

// Reglas de cada clave: cómo se valida y cómo se convierte desde el texto guardado.
export const CLAVES = {
  umbral_pocas_unidades: { tipo: 'entero', minimo: 1, maximo: 67, porDefecto: 5 },
  proveedor_ve_stock: { tipo: 'booleano', porDefecto: false },
  mensaje_catalogo: { tipo: 'texto', maximo: 255, porDefecto: '' },
  // Pedidos (migración 008): plazos para confirmar y para recoger.
  horas_pedido_pendiente: { tipo: 'entero', minimo: 1, maximo: 720, porDefecto: 48 },
  dias_pedido_confirmado: { tipo: 'entero', minimo: 1, maximo: 60, porDefecto: 7 }
};

function convertir(clave, texto) {
  const regla = CLAVES[clave];
  if (!regla) return texto;
  if (texto === null || texto === undefined) return regla.porDefecto;
  if (regla.tipo === 'entero') return Number.parseInt(texto, 10) || regla.porDefecto;
  if (regla.tipo === 'booleano') return texto === 'true';
  return texto;
}

// Devuelve { umbral_pocas_unidades: 5, proveedor_ve_stock: false, ... }
export async function obtenerValores() {
  const [filas] = await pool.query('SELECT clave, valor FROM configuracion');
  const valores = {};
  for (const clave of Object.keys(CLAVES)) valores[clave] = CLAVES[clave].porDefecto;
  for (const fila of filas) valores[fila.clave] = convertir(fila.clave, fila.valor);
  return valores;
}

export async function listarConDetalle() {
  const [filas] = await pool.query(
    `SELECT c.clave, c.valor, c.descripcion, c.actualizado_en, e.nombre AS actualizado_por
       FROM configuracion c
       LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario_actualizo
       LEFT JOIN empleados e ON e.id_empleado = u.id_empleado
      ORDER BY c.clave`
  );
  return filas.map((fila) => ({ ...fila, valor: convertir(fila.clave, fila.valor) }));
}

export async function guardar(conexion, clave, valor, idUsuario) {
  const [resultado] = await conexion.execute(
    'UPDATE configuracion SET valor = ?, id_usuario_actualizo = ? WHERE clave = ?',
    [String(valor), idUsuario, clave]
  );
  // Si la fila no existía (base sin la migración 005 completa), se crea.
  if (resultado.affectedRows === 0) {
    await conexion.execute(
      'INSERT INTO configuracion (clave, valor, descripcion, id_usuario_actualizo) VALUES (?, ?, ?, ?)',
      [clave, String(valor), '', idUsuario]
    );
  }
}

// "disponible", "pocas" o "agotado" según lo que se puede vender: stock menos lo apartado en pedidos
// (el cliente nunca ve el número exacto).
export function disponibilidad(stock, umbral) {
  if (stock <= 0) return 'agotado';
  if (stock <= umbral) return 'pocas';
  return 'disponible';
}
