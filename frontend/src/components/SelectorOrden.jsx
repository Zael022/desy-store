// Selector "Ordenar por" con su flecha, como en un catálogo de tienda.
// opciones: [{ valor, texto }]
import { ChevronDown } from 'lucide-react';

export default function SelectorOrden({ valor, alCambiar, opciones }) {
  return (
    <div className="selector-orden">
      <label htmlFor="orden">Ordenar por</label>
      <div className="selector-orden-caja">
        <select id="orden" value={valor} onChange={(evento) => alCambiar(evento.target.value)}>
          {opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.texto}
            </option>
          ))}
        </select>
        <ChevronDown size={24} strokeWidth={2.2} aria-hidden="true" />
      </div>
    </div>
  );
}
