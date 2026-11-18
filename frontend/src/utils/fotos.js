// Ayudantes de las fotos de productos.

// La foto que se ve en el catálogo: la primera que NO es de medidas (o null si no hay).
// Las fotos con medidas nunca son la principal (el backend las deja siempre al final).
export const fotoPrincipalDe = (fotos) => fotos.find((f) => !f.es_de_medidas)?.archivo ?? null;
