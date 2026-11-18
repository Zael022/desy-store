// Códigos de 6 dígitos: MFA, verificación de correo, de teléfono y cambio de correo.
//
// Reglas (iguales para todos los propósitos):
//   * Vencen a los 5 minutos (MFA) o 10 minutos (verificaciones) y se usan una sola vez.
//   * Máximo 5 intentos: al llegar al límite el código se anula y hay que pedir otro.
//   * Se guardan solo como HMAC-SHA256 y se comparan en tiempo constante.
//   * Pedir un código nuevo anula el anterior.
//   * Reenvío: hay que esperar 60 segundos y se permiten máximo 10 códigos por hora (CODIGOS_MAXIMO_POR_HORA).
import { ErrorHttp } from '../middleware/errores.js';
import { generarCodigo, hashCodigo, sonIguales } from './cripto.js';
import { enviarCodigo } from './notificaciones.js';

export const REGLAS_CODIGOS = {
  intentosMaximos: 5,
  esperaReenvioSegundos: 60,
  // Máximo de códigos por hora para una cuenta y un mismo propósito (se puede cambiar en el .env).
  get maximoPorHora() {
    return Number(process.env.CODIGOS_MAXIMO_POR_HORA) > 0 ? Number(process.env.CODIGOS_MAXIMO_POR_HORA) : 10;
  },
  minutosVigencia: { mfa: 5, verificar_correo: 10, verificar_telefono: 10, cambio_correo: 10 }
};

// Respeta la espera de 60 segundos y el máximo por hora. Lanza 429 si no se puede.
// En el MFA la espera de 60 segundos cuenta dentro del mismo inicio de sesión (desafío):
// así, quien cierra sesión y vuelve a entrar enseguida no tiene que esperar.
async function revisarLimites(conexion, idUsuario, proposito, idDesafio) {
  const [filas] = await conexion.execute(
    `SELECT COUNT(*) AS en_la_hora,
            TIMESTAMPDIFF(SECOND, MAX(CASE WHEN ${idDesafio === null ? 'TRUE' : 'id_desafio = ?'} THEN creado_en END), NOW()) AS segundos_desde_el_ultimo
       FROM codigos_verificacion
      WHERE id_usuario = ? AND proposito = ? AND creado_en > NOW() - INTERVAL 1 HOUR`,
    idDesafio === null ? [idUsuario, proposito] : [idDesafio, idUsuario, proposito]
  );
  const { en_la_hora: enLaHora, segundos_desde_el_ultimo: segundos } = filas[0];
  if (segundos !== null && segundos < REGLAS_CODIGOS.esperaReenvioSegundos) {
    const faltan = REGLAS_CODIGOS.esperaReenvioSegundos - segundos;
    throw new ErrorHttp(429, `Espere ${faltan} segundos antes de pedir otro código.`);
  }
  if (enLaHora >= REGLAS_CODIGOS.maximoPorHora) {
    throw new ErrorHttp(429, 'Ya pidió demasiados códigos en la última hora. Intente de nuevo más tarde.');
  }
}

// Crea un código, anula los anteriores del mismo propósito y lo envía.
// Si el envío falla, el código nuevo queda anulado y el error sube (503).
export async function crearYEnviarCodigo(conexion, { idUsuario, idDesafio = null, proposito, canal, destino }) {
  await revisarLimites(conexion, idUsuario, proposito, idDesafio);

  // Pedir un código nuevo invalida el anterior.
  await conexion.execute(
    'UPDATE codigos_verificacion SET anulado = 1 WHERE id_usuario = ? AND proposito = ? AND usado = 0 AND anulado = 0',
    [idUsuario, proposito]
  );

  const codigo = generarCodigo();
  const minutos = REGLAS_CODIGOS.minutosVigencia[proposito];
  const [resultado] = await conexion.execute(
    `INSERT INTO codigos_verificacion (id_usuario, id_desafio, proposito, canal, destino, hash_codigo, expira_en)
     VALUES (?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? MINUTE)`,
    [idUsuario, idDesafio, proposito, canal, destino, hashCodigo(codigo), minutos]
  );

  try {
    await enviarCodigo({ canal, destino, codigo, proposito, minutos });
  } catch (error) {
    await conexion.execute('UPDATE codigos_verificacion SET anulado = 1 WHERE id_codigo = ?', [resultado.insertId]);
    throw error;
  }
  return { minutos, esperaReenvio: REGLAS_CODIGOS.esperaReenvioSegundos };
}

// Verifica el código escrito por la persona. Si es correcto lo marca como usado y
// devuelve la fila (por ejemplo, para leer el "destino" de un cambio de correo).
// Debe llamarse dentro de una transacción: la fila se bloquea (FOR UPDATE) para
// que dos peticiones al mismo tiempo no puedan usar el mismo código dos veces.
export async function verificarCodigo(conexion, { idUsuario, idDesafio = null, proposito, codigo }) {
  const condicionDesafio = idDesafio === null ? 'id_desafio IS NULL' : 'id_desafio = ?';
  const parametros = idDesafio === null ? [idUsuario, proposito] : [idUsuario, proposito, idDesafio];
  const [filas] = await conexion.execute(
    `SELECT id_codigo, hash_codigo, intentos, destino, canal, (expira_en <= NOW()) AS vencido
       FROM codigos_verificacion
      WHERE id_usuario = ? AND proposito = ? AND ${condicionDesafio} AND usado = 0 AND anulado = 0
      ORDER BY id_codigo DESC
      LIMIT 1
      FOR UPDATE`,
    parametros
  );
  if (filas.length === 0) {
    throw new ErrorHttp(400, 'No hay un código vigente. Pida un código nuevo.');
  }
  const registro = filas[0];

  if (registro.vencido) {
    await conexion.execute('UPDATE codigos_verificacion SET anulado = 1 WHERE id_codigo = ?', [registro.id_codigo]);
    return { valido: false, mensaje: 'El código venció. Pida un código nuevo.', status: 400 };
  }

  if (!sonIguales(hashCodigo(String(codigo)), registro.hash_codigo)) {
    const intentos = registro.intentos + 1;
    const agotado = intentos >= REGLAS_CODIGOS.intentosMaximos;
    await conexion.execute('UPDATE codigos_verificacion SET intentos = ?, anulado = ? WHERE id_codigo = ?', [intentos, agotado ? 1 : 0, registro.id_codigo]);
    if (agotado) {
      return { valido: false, mensaje: 'Código incorrecto. Llegó al máximo de 5 intentos: pida un código nuevo.', status: 429 };
    }
    const quedan = REGLAS_CODIGOS.intentosMaximos - intentos;
    return { valido: false, mensaje: `Código incorrecto. Le quedan ${quedan} intento(s).`, status: 400 };
  }

  await conexion.execute('UPDATE codigos_verificacion SET usado = 1 WHERE id_codigo = ?', [registro.id_codigo]);
  return { valido: true, registro };
}
