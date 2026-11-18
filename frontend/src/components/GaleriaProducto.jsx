// Galería de la ficha de un producto: foto grande + miniaturas para cambiarla.
// - Flechas (o las teclas ← →) para pasar de una foto a otra.
// - Si el producto no tiene fotos, muestra el ícono de su categoría.
// - "acciones" (opcional) se dibuja debajo, por ejemplo el botón "Administrar fotos".
// - "medidas": nombres de las fotos con medidas (vienen al final); se marcan con "Medidas".
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Ruler } from 'lucide-react';
import FotoProducto from './FotoProducto.jsx';
import { urlFoto } from '../services/api.js';
import { fondoDeCategoria } from '../utils/fondosCategoria.js';

export default function GaleriaProducto({ producto, fotos = [], medidas = [], agotado = false, acciones = null }) {
  const [elegida, setElegida] = useState(0);
  const total = fotos.length;
  const indice = Math.min(elegida, Math.max(total - 1, 0)); // por si se borró una foto
  const archivo = fotos[indice] ?? null;
  const esDeMedidas = archivo !== null && medidas.includes(archivo);

  const mover = (paso) => setElegida((indice + paso + total) % total);

  function alTeclado(evento) {
    if (total < 2) return;
    if (evento.key === 'ArrowLeft') mover(-1);
    if (evento.key === 'ArrowRight') mover(1);
  }

  return (
    <div className="galeria">
      <div
        className={`ficha-imagen ${archivo ? 'con-foto' : fondoDeCategoria(producto.id_categoria)}`}
        role={total > 1 ? 'group' : undefined}
        aria-roledescription={total > 1 ? 'galería' : undefined}
        aria-label={total > 1 ? `Fotos de ${producto.nombre}` : undefined}
        tabIndex={total > 1 ? 0 : undefined}
        onKeyDown={alTeclado}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={archivo ?? 'sin-foto'}
            className="galeria-foto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <FotoProducto
              archivo={archivo}
              alt={`${total > 1 ? `${producto.nombre}, foto ${indice + 1} de ${total}` : producto.nombre}${esDeMedidas ? ', con medidas' : ''}`}
              nombreCategoria={producto.nombre_categoria}
              nombreCategoriaPadre={producto.nombre_categoria_padre}
              tamanoIcono={170}
              prioridad
            />
          </motion.div>
        </AnimatePresence>
        {agotado && <span className="producto-sello sello-agotado">Agotado</span>}
        {esDeMedidas && (
          <span className="galeria-medidas" aria-hidden="true">
            <Ruler size={14} /> Medidas
          </span>
        )}
        {total > 1 && (
          <>
            <button type="button" className="galeria-flecha galeria-anterior" onClick={() => mover(-1)} aria-label="Foto anterior">
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button type="button" className="galeria-flecha galeria-siguiente" onClick={() => mover(1)} aria-label="Foto siguiente">
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            <span className="galeria-contador" aria-hidden="true">
              {indice + 1} / {total}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <ul className="galeria-miniaturas" aria-label="Elegir foto">
          {fotos.map((foto, i) => (
            <li key={foto}>
              <button
                type="button"
                className="galeria-miniatura"
                aria-pressed={i === indice}
                aria-label={`Ver foto ${i + 1}${medidas.includes(foto) ? ' (medidas)' : ''}`}
                onClick={() => setElegida(i)}
              >
                <img src={urlFoto(foto)} alt="" width="72" height="90" loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {acciones}
    </div>
  );
}
