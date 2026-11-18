// Foto de un producto. Si el producto no tiene foto (o no carga),
// se muestra el ícono de su categoría, como antes.
import { useState } from 'react';
import IconoCategoria from './IconoCategoria.jsx';
import { urlFoto } from '../services/api.js';

export default function FotoProducto({ archivo, alt, nombreCategoria, nombreCategoriaPadre, tamanoIcono = 72, className = '', prioridad = false }) {
  const [fallo, setFallo] = useState(null); // archivo que no cargó

  if (!archivo || fallo === archivo) {
    return <IconoCategoria nombre={nombreCategoria} nombrePadre={nombreCategoriaPadre} size={tamanoIcono} strokeWidth={1.2} aria-hidden="true" />;
  }
  return (
    <img
      src={urlFoto(archivo)}
      alt={alt}
      className={`foto-producto ${className}`}
      width="480"
      height="600"
      loading={prioridad ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFallo(archivo)}
    />
  );
}
