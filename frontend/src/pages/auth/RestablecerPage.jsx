// Pantalla 5b: Restablecer contraseña con el enlace del correo (?token=...).
// Al cambiarla, el backend cierra todas las sesiones abiertas de la cuenta.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { KeyRound, Save } from 'lucide-react';
import MarcoAutenticacion from '../../components/MarcoAutenticacion.jsx';
import CampoContrasena from '../../components/CampoContrasena.jsx';
import Boton from '../../components/Boton.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { restablecerContrasena } from '../../services/authService.js';
import { errorContrasena } from '../../utils/validaciones.js';

export default function RestablecerPage() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') ?? '';
  const navegar = useNavigate();
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(token ? '' : 'El enlace está incompleto. Ábralo de nuevo desde su correo o pida uno nuevo.');

  async function enviar(evento) {
    evento.preventDefault();
    const problema = errorContrasena(contrasena, confirmacion);
    if (problema) {
      setError(problema);
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const respuesta = await restablecerContrasena(token, contrasena);
      navegar('/login', { replace: true, state: { mensaje: respuesta.message } });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAutenticacion titulo="Elegir contraseña nueva" icono={KeyRound} pie={<Link to="/recuperar">Pedir un enlace nuevo</Link>}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <MensajeFormulario>{error}</MensajeFormulario>
        <CampoContrasena id="contrasena" etiqueta="Contraseña nueva" valor={contrasena} alCambiar={setContrasena} autoComplete="new-password" ayuda="Mínimo 8 caracteres." disabled={enviando || !token} autoFocus />
        <CampoContrasena id="confirmacion" etiqueta="Repita la contraseña" valor={confirmacion} alCambiar={setConfirmacion} autoComplete="new-password" disabled={enviando || !token} />
        <Boton type="submit" icono={Save} cargando={enviando} disabled={!token} className="boton-ancho">
          {enviando ? 'Guardando...' : 'Guardar contraseña'}
        </Boton>
      </form>
    </MarcoAutenticacion>
  );
}
