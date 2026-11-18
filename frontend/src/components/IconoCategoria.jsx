// Ícono de un producto o categoría (se usa cuando el producto no tiene foto).
// Se elige según palabras del nombre de la categoría o, si no coincide, de su categoría principal.
// Si no coincide ninguna palabra, se usa una gema.
import { CircleDot, Flower, Flower2, Gem, KeyRound, Link2, Rabbit, Sparkles } from 'lucide-react';

function dibujar(nombre, propiedades) {
  const texto = String(nombre ?? '').toLowerCase(); // el nombre puede venir null (categoría sin principal)
  if (texto.includes('arete')) return <Sparkles {...propiedades} />;
  if (texto.includes('collar')) return <Gem {...propiedades} />;
  if (texto.includes('pulsera')) return <Link2 {...propiedades} />;
  if (texto.includes('anillo')) return <CircleDot {...propiedades} />;
  if (texto.includes('cabello')) return <Flower2 {...propiedades} />;
  if (texto.includes('llavero')) return <KeyRound {...propiedades} />;
  if (texto.includes('decora') || texto.includes('flor')) return <Flower {...propiedades} />;
  if (texto.includes('peluche') || texto.includes('crochet') || texto.includes('amigurumi')) return <Rabbit {...propiedades} />;
  return null;
}

export default function IconoCategoria({ nombre, nombrePadre, ...propiedades }) {
  return dibujar(nombre, propiedades) ?? dibujar(nombrePadre, propiedades) ?? <Gem {...propiedades} />;
}
