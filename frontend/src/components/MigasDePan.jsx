// Ruta de enlaces: Inicio > Productos > Aretes > Aretes argolla de plata.
// pasos: [{ texto, ruta? }]. El último paso es la página actual (sin enlace).
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';

export default function MigasDePan({ pasos }) {
  return (
    <nav aria-label="Ruta de navegación" className="migas">
      <ol>
        {pasos.map((paso, indice) => {
          const esUltimo = indice === pasos.length - 1;
          return (
            <li key={`${paso.texto}-${indice}`}>
              {esUltimo || !paso.ruta ? (
                <span aria-current={esUltimo ? 'page' : undefined}>{paso.texto}</span>
              ) : (
                <Link to={paso.ruta}>{paso.texto}</Link>
              )}
              {!esUltimo && <ChevronRight size={16} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
