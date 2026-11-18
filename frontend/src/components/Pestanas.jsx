// Pestañas accesibles (role="tablist"). opciones: [{ valor, texto, icono? }]
import { motion } from 'motion/react';

export default function Pestanas({ opciones, valor, alCambiar, etiqueta }) {
  return (
    <div className="pestanas-lista pestanas-roles" role="tablist" aria-label={etiqueta}>
      {opciones.map(({ valor: v, texto, icono: Icono, contador }) => (
        <button
          key={v}
          type="button"
          role="tab"
          id={`pestana-${v}`}
          aria-selected={valor === v}
          aria-controls={`panel-${v}`}
          className={valor === v ? 'pestana activa' : 'pestana'}
          onClick={() => alCambiar(v)}
        >
          {Icono && <Icono size={18} aria-hidden="true" />}
          <span>{texto}</span>
          {contador > 0 && <span className="pestana-contador">{contador}</span>}
          {valor === v && <motion.span layoutId={`subrayado-${etiqueta}`} className="pestana-subrayado" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
