// Fila horizontal con flechas para deslizar su contenido
// (se usa para "Nuestras categorías", "Poco stock" y "Productos similares").
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function FilaDeslizable({ titulo, accion, children }) {
  const refPista = useRef(null);

  // Mueve la fila casi un "ancho de pantalla" hacia la izquierda o la derecha.
  function mover(direccion) {
    const pista = refPista.current;
    if (pista) pista.scrollBy({ left: direccion * pista.clientWidth * 0.8, behavior: 'smooth' });
  }

  return (
    <section className="fila-deslizable" aria-label={titulo}>
      <div className="fila-encabezado">
        <h2>{titulo}</h2>
        {accion}
      </div>
      <div className="fila-cuerpo">
        <button type="button" className="carrusel-flecha fila-flecha" onClick={() => mover(-1)} aria-label={`Anterior en ${titulo}`}>
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <div className="fila-pista" ref={refPista}>
          {children}
        </div>
        <button type="button" className="carrusel-flecha fila-flecha" onClick={() => mover(1)} aria-label={`Siguiente en ${titulo}`}>
          <ChevronRight size={24} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
