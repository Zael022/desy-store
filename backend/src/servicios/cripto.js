// Herramientas de criptografía usadas por la seguridad del sistema.
// Analogía: un "hash" es como la huella digital de un dato. Con la huella se
// puede comprobar si alguien trae el dato correcto, pero no se puede
// reconstruir el dato a partir de la huella.
import crypto from 'node:crypto';
import { configuracion } from '../config/env.js';

// Token aleatorio largo (para cookies de sesión, desafío MFA, CSRF y enlaces).
// 32 bytes = 256 bits: imposible de adivinar.
export function generarToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// Hash SHA-256 de un token. En la base se guarda SOLO esto, nunca el token.
// Si alguien roba la base, no puede usar los hashes como cookies.
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Código de 6 dígitos con crypto.randomInt (aleatoriedad segura, no Math.random).
export function generarCodigo() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Los códigos de 6 dígitos son cortos, así que un hash simple se podría
// "adivinar" probando el millón de combinaciones. Por eso se usa HMAC con un
// secreto del .env: sin el secreto, el hash no sirve para nada.
export function hashCodigo(codigo) {
  return crypto.createHmac('sha256', configuracion.seguridad.codigosSecreto).update(String(codigo)).digest('hex');
}

// Compara dos hashes "en tiempo constante": tarda lo mismo aunque se parezcan
// o no, para que un atacante no pueda deducir el valor midiendo el tiempo.
export function sonIguales(hashA, hashB) {
  const a = Buffer.from(String(hashA), 'hex');
  const b = Buffer.from(String(hashB), 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

// Oculta parte de un correo o teléfono para mostrarlo: d*****a@gmail.com, +506 ****5678.
export function enmascararCorreo(correo) {
  const [usuario, dominio] = String(correo).split('@');
  if (!dominio) return '***';
  const visible = usuario.length <= 2 ? usuario[0] : `${usuario[0]}${'*'.repeat(Math.max(usuario.length - 2, 1))}${usuario.at(-1)}`;
  return `${visible}@${dominio}`;
}

export function enmascararTelefono(telefono) {
  const limpio = String(telefono).replace(/\s/g, '');
  return `${limpio.slice(0, 4)} ****${limpio.slice(-4)}`;
}
