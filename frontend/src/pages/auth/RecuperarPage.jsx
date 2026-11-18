// Pantalla 5a: Recuperar contraseña. La respuesta es la misma exista o no el
// correo (así nadie puede averiguar qué correos tienen cuenta).
import { useState } from 'react';
import { Link } from 'react-router';
import { KeyRound, Send } from 'lucide-react';
import MarcoAutenticacion from '../../components/MarcoAutenticacion.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import Boton from '../../components/Boton.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { pedirRecuperacion } from '../../services/authService.js';
import { PATRON_CORREO } from '../../utils/validaciones.js';

export default function RecuperarPage() {
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function enviar(evento) {
    evento.preventDefault();
    if (!PATRON_CORREO.test(correo.trim())) {
      setError('Escriba un correo válido.');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const respuesta = await pedirRecuperacion(correo.trim());
      setAviso(respuesta.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAutenticacion
      titulo="Recuperar contraseña"
      descripcion="Le enviaremos un enlace de un solo uso para elegir una contraseña nueva. Vence en 15 minutos."
      icono={KeyRound}
      pie={<Link to="/login">Volver a iniciar sesión</Link>}
    >
      <form className="formulario" onSubmit={enviar} noValidate>
        <MensajeFormulario tipo="exito">{aviso}</MensajeFormulario>
        <MensajeFormulario>{error}</MensajeFormulario>
        <CampoFormulario id="correo" etiqueta="Correo de su cuenta" tipo="email" valor={correo} alCambiar={(_c, v) => setCorreo(v)} obligatorio maxLength={100} disabled={enviando} autoFocus />
        <Boton type="submit" icono={Send} cargando={enviando} className="boton-ancho">
          {enviando ? 'Enviando...' : 'Enviar enlace'}
        </Boton>
      </form>
    </MarcoAutenticacion>
  );
}
