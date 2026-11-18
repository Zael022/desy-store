// Validaciones compartidas por todos los controladores.
// Cada función revisa UN valor: si está bien, devuelve el valor limpio;
// si está mal, lanza un ErrorHttp 400 con un mensaje claro.
import { ErrorHttp } from './errores.js';

const ID_MAXIMO = 4294967295; // máximo de un INT UNSIGNED en MySQL
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_TELEFONO = /^[0-9+\-()\s]{8,20}$/;
const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

// Revisa que el cuerpo de la petición sea un objeto JSON ({ ... }).
export function obtenerCuerpo(req) {
  const cuerpo = req.body;
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    throw new ErrorHttp(400, 'Debe enviar los datos como un objeto JSON y con el encabezado Content-Type: application/json.');
  }
  return cuerpo;
}

// IDs: enteros positivos. Acepta número (desde el JSON) o texto con dígitos (desde la URL).
export function validarId(valor, mensaje = 'El ID debe ser un número entero positivo.') {
  const texto = typeof valor === 'number' || typeof valor === 'string' ? String(valor) : '';
  if (!/^[1-9]\d*$/.test(texto) || Number(texto) > ID_MAXIMO) {
    throw new ErrorHttp(400, mensaje);
  }
  return Number(texto);
}

// Texto obligatorio: debe ser texto, no puede estar vacío ni tener solo espacios.
export function textoObligatorio(valor, etiqueta, maximo) {
  if (valor === undefined || valor === null) {
    throw new ErrorHttp(400, `${etiqueta} es un campo obligatorio.`);
  }
  if (typeof valor !== 'string') {
    throw new ErrorHttp(400, `${etiqueta} debe ser texto.`);
  }
  const limpio = valor.trim();
  if (limpio === '') {
    throw new ErrorHttp(400, `${etiqueta} es un campo obligatorio.`);
  }
  if (limpio.length > maximo) {
    throw new ErrorHttp(400, `${etiqueta} no puede tener más de ${maximo} caracteres.`);
  }
  return limpio;
}

// Texto opcional: si viene vacío se guarda como null.
export function textoOpcional(valor, etiqueta, maximo) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') {
    throw new ErrorHttp(400, `${etiqueta} debe ser texto.`);
  }
  const limpio = valor.trim();
  if (limpio === '') return null;
  if (limpio.length > maximo) {
    throw new ErrorHttp(400, `${etiqueta} no puede tener más de ${maximo} caracteres.`);
  }
  return limpio;
}

// Correo con formato básico nombre@dominio.ext (recibe un texto ya limpio o null).
export function validarCorreo(correo, etiqueta) {
  if (correo !== null && !PATRON_CORREO.test(correo)) {
    throw new ErrorHttp(400, `${etiqueta} no tiene un formato válido (ejemplo: nombre@correo.com).`);
  }
  return correo;
}

// Teléfono: de 8 a 20 caracteres con dígitos, espacios, guiones, + o paréntesis.
export function validarTelefono(telefono, etiqueta) {
  if (telefono !== null && !PATRON_TELEFONO.test(telefono)) {
    throw new ErrorHttp(400, `${etiqueta} debe tener entre 8 y 20 caracteres y solo números, espacios, guiones, + o paréntesis.`);
  }
  return telefono;
}

// Número entero dentro de un rango (por ejemplo, la cantidad de un movimiento).
export function enteroEnRango(valor, etiqueta, minimo, maximo) {
  if (valor === undefined || valor === null || valor === '') {
    throw new ErrorHttp(400, `${etiqueta} es un campo obligatorio.`);
  }
  if (typeof valor !== 'number' || !Number.isInteger(valor)) {
    throw new ErrorHttp(400, `${etiqueta} debe ser un número entero.`);
  }
  if (valor < minimo || valor > maximo) {
    throw new ErrorHttp(400, `${etiqueta} debe estar entre ${minimo} y ${maximo}.`);
  }
  return valor;
}

// Número con decimales dentro de un rango (por ejemplo, el precio).
export function decimalEnRango(valor, etiqueta, minimo, maximo, decimales = 2) {
  if (valor === undefined || valor === null || valor === '') {
    throw new ErrorHttp(400, `${etiqueta} es un campo obligatorio.`);
  }
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ErrorHttp(400, `${etiqueta} debe ser un número.`);
  }
  if (valor < minimo || valor > maximo) {
    throw new ErrorHttp(400, `${etiqueta} debe estar entre ${minimo} y ${maximo}.`);
  }
  const factor = 10 ** decimales;
  if (Math.abs(valor * factor - Math.round(valor * factor)) > 1e-7) {
    throw new ErrorHttp(400, `${etiqueta} puede tener como máximo ${decimales} decimales.`);
  }
  return valor;
}

// Verdadero o falso (true/false).
export function validarBooleano(valor, etiqueta) {
  if (typeof valor !== 'boolean') {
    throw new ErrorHttp(400, `${etiqueta} debe ser verdadero o falso.`);
  }
  return valor;
}

// Un valor que debe estar dentro de una lista (por ejemplo, el tipo de movimiento).
export function valorDeLista(valor, etiqueta, lista) {
  if (!lista.includes(valor)) {
    throw new ErrorHttp(400, `${etiqueta} debe ser uno de estos valores: ${lista.join(', ')}.`);
  }
  return valor;
}

// Fecha real con formato AAAA-MM-DD (rechaza, por ejemplo, 2026-02-30).
export function validarFecha(valor, etiqueta) {
  if (valor === undefined || valor === null || valor === '') {
    throw new ErrorHttp(400, `${etiqueta} es un campo obligatorio.`);
  }
  const partes = typeof valor === 'string' ? PATRON_FECHA.exec(valor) : null;
  if (!partes) {
    throw new ErrorHttp(400, `${etiqueta} debe tener el formato AAAA-MM-DD.`);
  }
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const esReal = fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  if (!esReal || anio < 2000 || anio > 2100) {
    throw new ErrorHttp(400, `${etiqueta} no es una fecha válida.`);
  }
  return valor;
}

// ---------------------------------------------------------------------
// Validaciones de cuentas y seguridad
// ---------------------------------------------------------------------

// Correo obligatorio, en minúsculas y sin espacios (así "Ana@Correo.com" y "ana@correo.com" son la misma cuenta).
export function correoObligatorio(valor, etiqueta = 'El correo') {
  const correo = textoObligatorio(valor, etiqueta, 100).toLowerCase();
  return validarCorreo(correo, etiqueta);
}

// Contraseña nueva: entre 8 y 128 caracteres (no se recorta: los espacios cuentan).
export function contrasenaNueva(valor, etiqueta = 'La contraseña') {
  if (typeof valor !== 'string' || valor.length === 0) {
    throw new ErrorHttp(400, `${etiqueta} es un campo obligatorio.`);
  }
  if (valor.length < 8) throw new ErrorHttp(400, `${etiqueta} debe tener al menos 8 caracteres.`);
  if (valor.length > 128) throw new ErrorHttp(400, `${etiqueta} no puede tener más de 128 caracteres.`);
  return valor;
}

// Teléfono en formato internacional (E.164), por ejemplo +50688887777.
export function telefonoInternacional(valor, etiqueta = 'El teléfono') {
  const telefono = textoObligatorio(valor, etiqueta, 20).replace(/[\s-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(telefono)) {
    throw new ErrorHttp(400, `${etiqueta} debe estar en formato internacional, por ejemplo +50688887777.`);
  }
  return telefono;
}

// Código de 6 dígitos.
export function codigoSeisDigitos(valor) {
  const codigo = typeof valor === 'string' || typeof valor === 'number' ? String(valor).trim() : '';
  if (!/^\d{6}$/.test(codigo)) throw new ErrorHttp(400, 'El código debe tener 6 dígitos.');
  return codigo;
}

// Token de un enlace (recuperación o invitación).
export function tokenDeEnlace(valor) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(valor)) {
    throw new ErrorHttp(400, 'El enlace no es válido o ya expiró. Pida uno nuevo.');
  }
  return valor;
}
