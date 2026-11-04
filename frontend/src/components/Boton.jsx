// Botón reutilizable con animación al pasar el mouse (hover) y al hacer clic (tap).
// Si "cargando" es true, muestra un ícono girando y se deshabilita solo.
import { motion } from 'motion/react';
import { LoaderCircle } from 'lucide-react';

export default function Boton({
  children,
  variante = 'primario', // primario | secundario | peligro | fantasma
  icono: Icono,
  cargando = false,
  disabled = false,
  type = 'button',
  className = '',
  ...resto
}) {
  const deshabilitado = disabled || cargando;

  return (
    <motion.button
      type={type}
      className={`boton boton-${variante} ${className}`}
      disabled={deshabilitado}
      aria-busy={cargando}
      whileHover={deshabilitado ? undefined : { y: -2, scale: 1.02 }}
      whileTap={deshabilitado ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      {...resto}
    >
      {cargando ? <LoaderCircle className="icono-girando" size={18} aria-hidden="true" /> : Icono && <Icono size={18} aria-hidden="true" />}
      {children && <span>{children}</span>}
    </motion.button>
  );
}
