// Valores iniciales de los filtros del catálogo (todo vacío = se ven todos los productos).
export const FILTROS_VACIOS = {
  precioMin: '',
  precioMax: '',
  categorias: [],
  materiales: [],
  proveedores: [],
  disponibilidad: 'todos'
};

// Opciones de "Disponibilidad" del catálogo público (sin números de stock).
export const OPCIONES_CATALOGO = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'disponible', texto: 'Disponibles' },
  { valor: 'pocas', texto: 'Pocas unidades' },
  { valor: 'agotado', texto: 'Agotados' }
];
