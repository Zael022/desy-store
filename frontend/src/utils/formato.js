// Funciones pequeñas para mostrar datos de forma amigable.

const formatoColones = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

// 8500 -> "₡8 500"
export function formatearPrecio(valor) {
  return formatoColones.format(valor);
}

// "2026-11-04" -> "04/11/2026"
export function formatearFecha(texto) {
  if (!texto) return '';
  const [anio, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${anio}`;
}

// Fecha de hoy en formato "AAAA-MM-DD" (la que usa <input type="date">).
export function fechaDeHoy() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// Convierte el texto de un <select> o <input type="number"> en número.
// Si está vacío devuelve null, para que el backend responda "es obligatorio".
export function aNumero(texto) {
  return texto === '' || texto === null || texto === undefined ? null : Number(texto);
}

// Quita tildes y pasa a minúsculas para comparar textos: "Anillo" y "anillo" son iguales.
export function normalizar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// "2026-11-04 15:40:00" -> "04/11/2026 15:40"
export function formatearFechaHora(texto) {
  if (!texto) return '';
  const [fecha, hora = ''] = texto.split(' ');
  return `${formatearFecha(fecha)}${hora ? ` ${hora.slice(0, 5)}` : ''}`;
}

// Fecha de hace N días en formato "AAAA-MM-DD".
export function fechaHaceDias(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export const TEXTO_DISPONIBILIDAD = { disponible: 'Disponible', pocas: 'Pocas unidades', agotado: 'Agotado' };
