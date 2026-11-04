// "Imagen" de un producto o categoría: como el sistema no guarda fotos,
// se dibuja un ícono según palabras del nombre de la categoría.
// Si no coincide ninguna palabra, se usa una gema.
import { CircleDot, Flower2, Gem, Link2, Sparkles } from 'lucide-react';

export default function IconoCategoria({ nombre, ...propiedades }) {
  const texto = nombre.toLowerCase();
  if (texto.includes('arete')) return <Sparkles {...propiedades} />;
  if (texto.includes('collar')) return <Gem {...propiedades} />;
  if (texto.includes('pulsera')) return <Link2 {...propiedades} />;
  if (texto.includes('anillo')) return <CircleDot {...propiedades} />;
  if (texto.includes('cabello')) return <Flower2 {...propiedades} />;
  return <Gem {...propiedades} />;
}
