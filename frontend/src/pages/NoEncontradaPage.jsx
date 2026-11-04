// Página que se muestra si la dirección no existe.
import { Link } from 'react-router';
import { MapPinOff } from 'lucide-react';
import PaginaAnimada from '../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../components/EncabezadoPagina.jsx';

export default function NoEncontradaPage() {
  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Inventario', 'Página no encontrada']} />
      <div className="tarjeta estado">
        <MapPinOff size={34} aria-hidden="true" />
        <p>La dirección que escribió no existe en el sistema.</p>
        <p>
          Vuelva al <Link to="/">inicio</Link> o use el menú ☰ para ir a otra sección.
        </p>
      </div>
    </PaginaAnimada>
  );
}
