// Ayudantes para las categorías con subcategorías (Crochet > Peluches...).
// Solo hay dos niveles: categoría principal y subcategoría.

// Ordena: cada categoría principal y debajo sus subcategorías (con "nivel" 0 o 1).
export function ordenarJerarquia(categorias) {
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  const principales = categorias.filter((c) => !c.id_categoria_padre).sort(porNombre);
  const resultado = [];
  for (const principal of principales) {
    resultado.push({ ...principal, nivel: 0 });
    categorias
      .filter((c) => c.id_categoria_padre === principal.id_categoria)
      .sort(porNombre)
      .forEach((hija) => resultado.push({ ...hija, nivel: 1 }));
  }
  // Por si alguna subcategoría quedó sin su principal en la lista.
  const yaEstan = new Set(resultado.map((c) => c.id_categoria));
  categorias.filter((c) => !yaEstan.has(c.id_categoria)).forEach((c) => resultado.push({ ...c, nivel: 0 }));
  return resultado;
}

// Texto para listas desplegables: "Crochet › Peluches".
export function etiquetaCategoria(categoria, categorias) {
  const padre = categorias.find((c) => c.id_categoria === categoria.id_categoria_padre);
  return padre ? `${padre.nombre} › ${categoria.nombre}` : categoria.nombre;
}

// IDs que incluye una selección: si se elige "Crochet", también entran sus subcategorías.
export function idsIncluidos(seleccion, categorias) {
  const ids = new Set(seleccion);
  for (const c of categorias) {
    if (c.id_categoria_padre && ids.has(c.id_categoria_padre)) ids.add(c.id_categoria);
  }
  return ids;
}

// Cuántos productos hay en una categoría, contando los de sus subcategorías.
export function contarProductos(productos, idCategoria, categorias) {
  const ids = idsIncluidos([idCategoria], categorias);
  return productos.filter((p) => ids.has(p.id_categoria)).length;
}
