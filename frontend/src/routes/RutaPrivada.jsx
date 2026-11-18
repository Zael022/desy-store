// Ruta privada: solo deja ver la página si hay sesión y el rol está permitido.
// Esto es COSMÉTICO: evita mostrar pantallas que no sirven. La protección real
// está en el backend, que revisa la sesión y el rol en cada petición.
import { Navigate, useLocation } from 'react-router';
import { useAutenticacion } from '../hooks/useAutenticacion.js';
import { Cargando, ErrorCarga } from '../components/EstadoLista.jsx';
import SinPermisoPage from '../pages/SinPermisoPage.jsx';

export default function RutaPrivada({ roles, children }) {
  const { usuario, cargando, errorConexion, saliendo, recargarSesion } = useAutenticacion();
  const ubicacion = useLocation();

  if (cargando) return <Cargando texto="Revisando su sesión..." />;
  if (!usuario && errorConexion) {
    return (
      <div className="pagina tarjeta">
        <ErrorCarga error={errorConexion} alReintentar={recargarSesion} />
      </div>
    );
  }
  if (!usuario) {
    // Recién cerró sesión: va al login sin recordar esta página (la próxima persona entra a la suya).
    if (saliendo) return <Navigate to="/login" replace state={{ mensaje: 'Cerró sesión correctamente.' }} />;
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname + ubicacion.search, mensaje: 'Inicie sesión para continuar.' }} />;
  }
  if (roles && !roles.includes(usuario.rol)) return <SinPermisoPage />;
  return children;
}
