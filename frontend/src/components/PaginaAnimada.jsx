// Envuelve cada página para que aparezca con una animación suave.
// Si el sistema tiene activado "reducir movimiento", la página solo cambia
// su opacidad y no se desplaza. useReducedMotion lee esa preferencia directamente,
// así se respeta desde el primer dibujo de la página.
import { motion, useReducedMotion } from 'motion/react';

export default function PaginaAnimada({ children }) {
  const reducirMovimiento = useReducedMotion();

  return (
    <motion.div
      className="pagina"
      initial={{ opacity: 0, y: reducirMovimiento ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
