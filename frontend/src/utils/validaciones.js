// Validaciones rápidas en el navegador (para avisar antes de enviar).
// El backend vuelve a validar todo: estas solo ayudan a la persona.
export const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function errorContrasena(contrasena, confirmacion) {
  if (contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (contrasena.length > 128) return 'La contraseña no puede tener más de 128 caracteres.';
  if (confirmacion !== undefined && contrasena !== confirmacion) return 'Las contraseñas no coinciden.';
  return '';
}

// Acepta "+506 8888-7777" y lo deja como "+50688887777".
export function limpiarTelefono(texto) {
  return texto.replace(/[\s-]/g, '');
}

export function errorTelefono(texto) {
  if (!texto.trim()) return '';
  return /^\+[1-9]\d{7,14}$/.test(limpiarTelefono(texto)) ? '' : 'Use el formato internacional, por ejemplo +506 8888 7777.';
}
