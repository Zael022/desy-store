// Tarjeta con un número grande (se usa en los paneles de administración y de la dueña).
import { motion } from 'motion/react';

export default function TarjetaResumen({ icono: Icono, titulo, valor, detalle, indice = 0, aviso = false }) {
  return (
    <motion.article
      className={aviso ? 'tarjeta tarjeta-resumen tarjeta-resumen-aviso' : 'tarjeta tarjeta-resumen'}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.06 * indice } }}
    >
      <span className="resumen-icono" aria-hidden="true">
        <Icono size={22} />
      </span>
      <div>
        <p className="resumen-titulo">{titulo}</p>
        <p className="resumen-valor">{valor}</p>
        {detalle && <p className="resumen-detalle">{detalle}</p>}
      </div>
    </motion.article>
  );
}
