// Fondo de color suave para la "imagen" de cada producto o categoría.
// Son seis clases de index.css; cada categoría usa siempre la misma según su ID.
const FONDOS = ['fondo-rosa', 'fondo-salvia', 'fondo-menta', 'fondo-amarillo', 'fondo-durazno', 'fondo-arena'];

export function fondoDeCategoria(idCategoria) {
  return FONDOS[idCategoria % FONDOS.length];
}
