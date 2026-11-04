// Ventana modal reutilizable (la usan el formulario de productos,
// el modal de confirmación y el menú lateral).
// - Se cierra con Escape o haciendo clic en el fondo oscuro.
// - Al abrirse, el foco del teclado pasa a "refFocoInicial" (o al primer elemento).
// - La tecla Tab no se sale del modal mientras está abierto.
// - Al cerrarse, el foco vuelve al botón que lo abrió.
// variante: "centro" (caja en el medio) o "lateral" (panel que entra desde la izquierda).
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

const ANIMACIONES = {
  centro: {
    initial: { opacity: 0, scale: 0.92, y: 24 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.94, y: 12 }
  },
  lateral: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' }
  }
};

export default function Modal({
  abierto,
  alCerrar,
  bloqueado = false, // true mientras se guarda o elimina: no deja cerrar
  rol = 'dialog',
  idTitulo,
  idDescripcion,
  refFocoInicial,
  variante = 'centro',
  className = '',
  children
}) {
  const refCaja = useRef(null);
  // Guardamos los valores más recientes en "refs" para que el efecto de abajo
  // solo se ejecute al abrir o cerrar (y no en cada renderizado).
  const refBloqueado = useRef(bloqueado);
  const refAlCerrar = useRef(alCerrar);
  useEffect(() => {
    refBloqueado.current = bloqueado;
    refAlCerrar.current = alCerrar;
  });

  useEffect(() => {
    if (!abierto) return undefined;

    const elementoAnterior = document.activeElement;
    const primero = refCaja.current?.querySelector(ENFOCABLES);
    (refFocoInicial?.current ?? primero)?.focus();

    function manejarTeclado(evento) {
      if (evento.key === 'Escape' && !refBloqueado.current) {
        evento.preventDefault();
        refAlCerrar.current();
        return;
      }
      if (evento.key === 'Tab' && refCaja.current) {
        // "Trampa de foco": Tab da la vuelta dentro del modal.
        const enfocables = refCaja.current.querySelectorAll(ENFOCABLES);
        if (enfocables.length === 0) return;
        const inicio = enfocables[0];
        const fin = enfocables[enfocables.length - 1];
        if (evento.shiftKey && document.activeElement === inicio) {
          evento.preventDefault();
          fin.focus();
        } else if (!evento.shiftKey && document.activeElement === fin) {
          evento.preventDefault();
          inicio.focus();
        } else if (!refCaja.current.contains(document.activeElement)) {
          evento.preventDefault();
          inicio.focus();
        }
      }
    }

    document.addEventListener('keydown', manejarTeclado);
    return () => {
      document.removeEventListener('keydown', manejarTeclado);
      // Si el botón que abrió el modal todavía existe, el foco vuelve a él.
      if (elementoAnterior instanceof HTMLElement && document.contains(elementoAnterior)) {
        elementoAnterior.focus();
      }
    };
    // refFocoInicial es un ref: no cambia entre renderizados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const animacion = ANIMACIONES[variante];

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          className={`modal-fondo modal-fondo-${variante}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(evento) => {
            // Clic en el fondo oscuro (no dentro de la caja) = cerrar.
            if (evento.target === evento.currentTarget && !bloqueado) alCerrar();
          }}
        >
          <motion.div
            ref={refCaja}
            className={`modal modal-${variante} ${className}`}
            role={rol}
            aria-modal="true"
            aria-labelledby={idTitulo}
            aria-describedby={idDescripcion}
            initial={animacion.initial}
            animate={animacion.animate}
            exit={animacion.exit}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
