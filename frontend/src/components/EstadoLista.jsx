// Mensajes para los estados de una lista: cargando, error de conexión o sin registros.
import { Inbox, LoaderCircle, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react';
import Boton from './Boton.jsx';

export function Cargando({ texto = 'Cargando datos...' }) {
  return (
    <div className="estado estado-cargando" role="status">
      <LoaderCircle className="icono-girando" size={28} aria-hidden="true" />
      <p>{texto}</p>
    </div>
  );
}

export function ErrorCarga({ error, alReintentar }) {
  const Icono = error?.esDeConexion ? WifiOff : TriangleAlert;
  return (
    <div className="estado estado-error" role="alert">
      <Icono size={30} aria-hidden="true" />
      <p>
        <strong>{error?.esDeConexion ? 'Error de conexión' : 'No se pudieron cargar los datos'}</strong>
      </p>
      <p>{error?.message}</p>
      <Boton variante="secundario" icono={RefreshCw} onClick={alReintentar}>
        Reintentar
      </Boton>
    </div>
  );
}

export function SinRegistros({ texto = 'Todavía no hay registros. Use el formulario para agregar el primero.' }) {
  return (
    <div className="estado estado-vacio">
      <Inbox size={30} aria-hidden="true" />
      <p>{texto}</p>
    </div>
  );
}
