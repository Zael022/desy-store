// Mensaje dentro de un formulario: error (rojo), éxito (verde) o información.
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';

const ICONOS = { error: TriangleAlert, exito: CircleCheck, info: Info };

export default function MensajeFormulario({ tipo = 'error', children }) {
  if (!children) return null;
  const Icono = ICONOS[tipo];
  return (
    <p className={`mensaje-formulario mensaje-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono size={18} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
