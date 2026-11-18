// Se muestra si alguien abre una dirección que su rol no puede usar.
import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import PaginaAnimada from '../components/PaginaAnimada.jsx';
import { useAutenticacion } from '../hooks/useAutenticacion.js';
import { INICIO_POR_ROL } from '../context/contextoAutenticacion.js';

export default function SinPermisoPage() {
  const { usuario } = useAutenticacion();
  return (
    <PaginaAnimada>
      <div className="tarjeta estado">
        <Lock size={34} aria-hidden="true" />
        <h1>Esta sección no es para su cuenta</h1>
        <p>Su rol no tiene permiso para ver esta página.</p>
        <Link to={usuario ? INICIO_POR_ROL[usuario.rol] : '/'}>Ir a mi pantalla principal</Link>
      </div>
    </PaginaAnimada>
  );
}
