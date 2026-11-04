// Sección desplegable de la tarjeta "Filtros" (PRECIO, CATEGORÍA, ...).
// Al hacer clic en el título se abre o se cierra con una animación.
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export default function SeccionFiltro({ id, titulo, activos = 0, children }) {
  const [abierta, setAbierta] = useState(false);

  return (
    <div className="seccion-filtro">
      <button type="button" className="seccion-filtro-titulo" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} aria-controls={id}>
        <span>
          {titulo}
          {activos > 0 && <span className="filtro-contador">{activos}</span>}
        </span>
        <motion.span animate={{ rotate: abierta ? 180 : 0 }} transition={{ duration: 0.2 }} aria-hidden="true">
          <ChevronDown size={26} strokeWidth={2.2} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            id={id}
            className="seccion-filtro-contenido"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="seccion-filtro-interior">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
