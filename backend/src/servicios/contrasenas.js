// Hash de contraseñas.
// Se usa Argon2id, el algoritmo recomendado hoy: es lento a propósito y usa
// memoria, así que probar millones de contraseñas robadas sale carísimo.
//
// El paquete argon2 se instala como "dependencia opcional". Si en algún equipo
// no se pudiera instalar, el sistema usa bcrypt con costo 12 (bcryptjs, que
// está escrito en JavaScript puro y siempre instala). Los dos formatos se
// reconocen por cómo empieza el hash ($argon2id$ o $2b$), así que una base
// puede tener hashes de ambos tipos sin problema.
import bcrypt from 'bcryptjs';

const COSTO_BCRYPT = 12;
export const LONGITUD_MINIMA = 8;
export const LONGITUD_MAXIMA = 128;

let argon2 = null;
try {
  argon2 = (await import('argon2')).default;
} catch {
  console.warn('[Contraseñas] El paquete argon2 no está disponible; se usará bcrypt con costo 12.');
}

export const algoritmoEnUso = argon2 ? 'argon2id' : 'bcrypt (costo 12)';

export async function generarHashContrasena(contrasena) {
  if (argon2) {
    // Parámetros recomendados por OWASP para Argon2id: 19 MiB de memoria, 2 pasadas.
    return argon2.hash(contrasena, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }
  return bcrypt.hash(contrasena, COSTO_BCRYPT);
}

export async function verificarContrasena(hash, contrasena) {
  if (!hash) return false;
  try {
    if (hash.startsWith('$argon2')) {
      if (!argon2) throw new Error('Hay una contraseña guardada con Argon2 pero el paquete argon2 no está instalado.');
      return await argon2.verify(hash, contrasena);
    }
    return await bcrypt.compare(contrasena, hash);
  } catch (error) {
    if (error.message.includes('argon2 no está instalado')) throw error;
    return false;
  }
}

// Hash falso para "gastar" el mismo tiempo cuando el correo no existe.
// Así un atacante no puede saber, midiendo el tiempo, si un correo está registrado.
let hashFalso = null;
export async function simularVerificacion() {
  if (!hashFalso) hashFalso = await generarHashContrasena('contrasena-que-nadie-usa-123');
  await verificarContrasena(hashFalso, 'otra-contrasena-cualquiera');
}
