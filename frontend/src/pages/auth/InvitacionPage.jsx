// Aceptar una invitación (cuentas de personal y de proveedores, creadas por la tienda).
// El enlace llega al correo; al definir la contraseña, el correo queda verificado.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { MailOpen, Save } from 'lucide-react';
import MarcoAutenticacion from '../../components/MarcoAutenticacion.jsx';
import CampoContrasena from '../../components/CampoContrasena.jsx';
import Boton from '../../components/Boton.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { Cargando } from '../../components/EstadoLista.jsx';
import { aceptarInvitacion, validarInvitacion } from '../../services/authService.js';
import { errorContrasena } from '../../utils/validaciones.js';

export default function InvitacionPage() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') ?? '';
  const navegar = useNavigate();
  const [invitacion, setInvitacion] = useState(null);
  const [cargando, setCargando] = useState(Boolean(token));
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(token ? '' : 'El enlace de invitación está incompleto.');

  useEffect(() => {
    if (!token) return;
    validarInvitacion(token)
      .then(setInvitacion)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [token]);

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
      const respuesta = await aceptarInvitacion(token, contrasena);
      navegar('/login', { replace: true, state: { mensaje: respuesta.message, correo: invitacion.correo } });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAutenticacion
      titulo="Activar su cuenta"
      descripcion={invitacion ? `Hola ${invitacion.nombre}. La tienda le creó una cuenta con el rol "${invitacion.nombre_rol}" para ${invitacion.correo}.` : undefined}
      icono={MailOpen}
      pie={<Link to="/login">Ir a iniciar sesión</Link>}
    >
      {cargando ? (
        <Cargando texto="Revisando la invitación..." />
      ) : (
        <form className="formulario" onSubmit={enviar} noValidate>
          <MensajeFormulario>{error}</MensajeFormulario>
          {invitacion && (
            <>
              <CampoContrasena id="contrasena" etiqueta="Elija su contraseña" valor={contrasena} alCambiar={setContrasena} autoComplete="new-password" ayuda="Mínimo 8 caracteres." disabled={enviando} autoFocus />
              <CampoContrasena id="confirmacion" etiqueta="Repita la contraseña" valor={confirmacion} alCambiar={setConfirmacion} autoComplete="new-password" disabled={enviando} />
              <Boton type="submit" icono={Save} cargando={enviando} className="boton-ancho">
                {enviando ? 'Activando...' : 'Activar cuenta'}
              </Boton>
            </>
          )}
        </form>
      )}
    </MarcoAutenticacion>
  );
}
