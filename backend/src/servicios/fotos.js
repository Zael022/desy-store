// Fotos de los productos: revisar, convertir, guardar y borrar los archivos.
//
// En palabras simples: la base de datos guarda solo el NOMBRE del archivo
// (como una ficha que dice "la foto está en el cajón 3"), y la imagen vive
// en la carpeta configuracion.fotos.carpeta (por defecto backend/uploads/productos).
//
// Seguridad:
//   * Nunca se confía en el nombre ni en la extensión que manda el navegador:
//     sharp abre la imagen y revisa qué es en realidad (JPEG, PNG o WebP).
//   * Toda foto se vuelve a dibujar como WebP nueva: así se borran los datos
//     ocultos del celular (como la ubicación GPS) y cualquier contenido extraño.
//   * El nombre del archivo lo inventa el servidor (32 letras al azar), así
//     nadie puede pisar otra foto ni escribir fuera de la carpeta.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { configuracion } from '../config/env.js';
import { ErrorHttp } from '../middleware/errores.js';

export const MAXIMO_FOTOS_POR_PRODUCTO = 8;
export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB por foto
const FORMATOS_ACEPTADOS = new Set(['jpeg', 'png', 'webp']);
const LADO_MINIMO = 200; // píxeles
const PIXELES_MAXIMOS = 40_000_000; // evita "bombas" de imagen enormes

// Nombres válidos: letras minúsculas, números y guiones, terminados en .webp.
// (Los subidos son 32 letras al azar; los iniciales se llaman como el código, ej. cro-pel-001-1.webp.)
const PATRON_ARCHIVO = /^[a-z0-9][a-z0-9-]{0,90}\.webp$/;

// Fotos de los productos reales de Desy (se copian a la carpeta de fotos con el seed).
export const CARPETA_FOTOS_INICIALES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'database', 'fotos');

export function nombreValido(archivo) {
  return typeof archivo === 'string' && PATRON_ARCHIVO.test(archivo);
}

// Ruta completa del archivo dentro de la carpeta de fotos (null si el nombre no es válido).
export function rutaDeFoto(archivo) {
  return nombreValido(archivo) ? path.join(configuracion.fotos.carpeta, archivo) : null;
}

// Dirección para el navegador (pasa por la API, ver GET /api/fotos/:archivo).
export function urlDeFoto(archivo) {
  return `/api/fotos/${archivo}`;
}

async function asegurarCarpeta() {
  await fs.mkdir(configuracion.fotos.carpeta, { recursive: true });
}

// Revisa la imagen y la convierte en un WebP de máximo 1200 x 1500 píxeles.
export async function prepararImagen(buffer) {
  let datos;
  try {
    datos = await sharp(buffer, { limitInputPixels: PIXELES_MAXIMOS }).metadata();
  } catch {
    throw new ErrorHttp(400, 'El archivo no es una imagen válida. Use una foto JPG, PNG o WebP.');
  }
  if (!FORMATOS_ACEPTADOS.has(datos.format)) {
    throw new ErrorHttp(400, 'Formato no permitido. Use una foto JPG, PNG o WebP.');
  }
  if ((datos.width ?? 0) < LADO_MINIMO || (datos.height ?? 0) < LADO_MINIMO) {
    throw new ErrorHttp(400, `La foto es muy pequeña. Debe medir al menos ${LADO_MINIMO} x ${LADO_MINIMO} píxeles.`);
  }
  try {
    return await sharp(buffer, { limitInputPixels: PIXELES_MAXIMOS })
      .rotate() // respeta la orientación con que se tomó la foto
      .resize({ width: 1200, height: 1500, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }) // sin .keepMetadata(): se descartan EXIF y GPS
      .toBuffer();
  } catch {
    throw new ErrorHttp(400, 'No se pudo procesar la imagen. Pruebe con otra foto.');
  }
}

// Guarda una imagen ya preparada con un nombre al azar. Devuelve el nombre.
export async function guardarFoto(bufferWebp) {
  await asegurarCarpeta();
  const archivo = `${crypto.randomBytes(16).toString('hex')}.webp`; // 32 letras al azar
  await fs.writeFile(rutaDeFoto(archivo), bufferWebp, { flag: 'wx' }); // 'wx' = falla si ya existe
  return archivo;
}

// Borra el archivo de una foto. Si ya no estaba, no pasa nada.
export async function borrarArchivo(archivo) {
  const ruta = rutaDeFoto(archivo);
  if (!ruta) return;
  try {
    await fs.unlink(ruta);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('[Fotos] No se pudo borrar', archivo, error.message);
  }
}

// Copia una foto inicial (database/fotos) a la carpeta de fotos si todavía no está.
// Devuelve false si la foto inicial no existe.
export async function copiarFotoInicial(archivo) {
  if (!nombreValido(archivo)) return false;
  await asegurarCarpeta();
  try {
    await fs.copyFile(path.join(CARPETA_FOTOS_INICIALES, archivo), rutaDeFoto(archivo), fs.constants.COPYFILE_EXCL);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return true;
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
