// Pantalla 2: Iniciar sesión (paso 1 de 2: correo y contraseña).
// Si son correctos, el backend NO abre la sesión todavía: crea un "desafío"
// y aquí pasamos a la pantalla del código (MFA).
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { LogIn } from 'lucide-react';
import MarcoAutenticacion from '../../components/MarcoAutenticacion.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import CampoContrasena from '../../components/CampoContrasena.jsx';
import Boton from '../../components/Boton.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { iniciarSesion } from '../../services/authService.js';
import { useAutenticacion } from '../../hooks/useAutenticacion.js';
import { INICIO_POR_ROL } from '../../context/contextoAutenticacion.js';

export default function LoginPage() {
  const { usuario } = useAutenticacion();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState(ubicacion.state?.correo ?? '');
  const [contrasena, setContrasena] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  if (usuario) return <Navigate to={INICIO_POR_ROL[usuario.rol]} replace />;

  async function enviar(evento) {
    evento.preventDefault();
    if (!correo.trim() || !contrasena) {
      setError('Escriba su correo y su contraseña.');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const respuesta = await iniciarSesion(correo.trim(), contrasena);
      if (respuesta.estado === 'verificar_correo') {
        navegar('/verificar-correo', { state: { correo: respuesta.correo, mensaje: respuesta.message } });
        return;
      }
      navegar('/mfa', { state: { canales: respuesta.canales, desde: ubicacion.state?.desde } });
    } catch (err) {
      setError(err.message);
      setContrasena('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAutenticacion
      titulo="Iniciar sesión"
      descripcion="Después de su contraseña le pediremos un código que llega a su correo o a su teléfono."
      icono={LogIn}
      pie={
        <>
          <Link to="/recuperar">Olvidé mi contraseña</Link>
          <span>
            ¿No tiene cuenta? <Link to="/registro">Crear cuenta de cliente</Link>
          </span>
        </>
      }
    >
      <form className="formulario" onSubmit={enviar} noValidate>
        <MensajeFormulario tipo="info">{ubicacion.state?.mensaje}</MensajeFormulario>
        <MensajeFormulario>{error}</MensajeFormulario>
        <CampoFormulario id="correo" etiqueta="Correo" tipo="email" valor={correo} alCambiar={(_c, v) => setCorreo(v)} obligatorio autoComplete="username" maxLength={100} disabled={enviando} autoFocus />
        <CampoContrasena id="contrasena" etiqueta="Contraseña" valor={contrasena} alCambiar={setContrasena} disabled={enviando} />
        <Boton type="submit" icono={LogIn} cargando={enviando} className="boton-ancho">
          {enviando ? 'Revisando...' : 'Continuar'}
        </Boton>
      </form>
    </MarcoAutenticacion>
  );
}
