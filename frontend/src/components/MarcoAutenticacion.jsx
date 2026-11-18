// Marco visual de las pantallas de cuenta (login, registro, MFA...):
// una tarjeta centrada con el logo de Desy, un título y un texto de ayuda.
import { motion, useReducedMotion } from 'motion/react';
import logoDesy from '../assets/logo-desy.png';

export default function MarcoAutenticacion({ titulo, descripcion, icono: Icono, children, pie }) {
  const reducir = useReducedMotion();
  return (
    <div className="pagina pagina-autenticacion">
      <motion.section
        className="tarjeta tarjeta-autenticacion"
        aria-labelledby="titulo-autenticacion"
        initial={{ opacity: 0, y: reducir ? 0 : 20, scale: reducir ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <img src={logoDesy} alt="Desy" className="autenticacion-logo" />
        {Icono && (
          <span className="autenticacion-icono" aria-hidden="true">
            <Icono size={26} />
          </span>
        )}
        <h1 id="titulo-autenticacion">{titulo}</h1>
        {descripcion && <p className="autenticacion-descripcion">{descripcion}</p>}
        {children}
        {pie && <div className="autenticacion-pie">{pie}</div>}
      </motion.section>
    </div>
  );
}
