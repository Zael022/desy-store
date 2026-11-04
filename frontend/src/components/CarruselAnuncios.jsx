// Carrusel de anuncios de la página de Inicio (como los banners de una tienda).
// Cambia solo cada 6 segundos; también se puede mover con las flechas o los puntos.
// anuncios: [{ titulo, texto, ruta, textoBoton, estilo }]
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SEGUNDOS_POR_ANUNCIO = 6;

export default function CarruselAnuncios({ anuncios }) {
  const [actual, setActual] = useState(0);
  const total = anuncios.length;

  // Avanza automáticamente. Al cambiar "actual" el temporizador se reinicia.
  useEffect(() => {
    const temporizador = setTimeout(() => setActual((n) => (n + 1) % total), SEGUNDOS_POR_ANUNCIO * 1000);
    return () => clearTimeout(temporizador);
  }, [actual, total]);

  const anterior = () => setActual((n) => (n - 1 + total) % total);
  const siguiente = () => setActual((n) => (n + 1) % total);
  const anuncio = anuncios[actual];

  return (
    <section className="carrusel" aria-roledescription="carrusel" aria-label="Anuncios del inventario">
      <AnimatePresence mode="wait">
        <motion.div
          key={actual}
          className={`anuncio anuncio-${anuncio.estilo}`}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.4 }}
          aria-live="polite"
        >
          <p className="anuncio-titulo">{anuncio.titulo}</p>
          <p className="anuncio-texto">{anuncio.texto}</p>
          <Link to={anuncio.ruta} className="anuncio-boton">
            {anuncio.textoBoton}
          </Link>
        </motion.div>
      </AnimatePresence>

      <button type="button" className="carrusel-flecha carrusel-anterior" onClick={anterior} aria-label="Anuncio anterior">
        <ChevronLeft size={28} aria-hidden="true" />
      </button>
      <button type="button" className="carrusel-flecha carrusel-siguiente" onClick={siguiente} aria-label="Anuncio siguiente">
        <ChevronRight size={28} aria-hidden="true" />
      </button>

      <div className="carrusel-puntos">
        {anuncios.map((item, indice) => (
          <button
            key={item.titulo}
            type="button"
            className={indice === actual ? 'punto activo' : 'punto'}
            onClick={() => setActual(indice)}
            aria-label={`Ver anuncio ${indice + 1} de ${total}`}
            aria-current={indice === actual}
          />
        ))}
      </div>
    </section>
  );
}
