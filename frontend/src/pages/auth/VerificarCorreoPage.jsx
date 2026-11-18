// Verificación del correo con un código de 6 dígitos (obligatoria antes del primer ingreso).
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { MailCheck, RotateCcw } from 'lucide-react';
import MarcoAutenticacion from '../../components/MarcoAutenticacion.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import CampoCodigo from '../../components/CampoCodigo.jsx';
import Boton from '../../components/Boton.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { reenviarVerificacion, verificarCorreo } from '../../services/authService.js';
import { useCuentaRegresiva } from '../../hooks/useCuentaRegresiva.js';

export default function VerificarCorreoPage() {
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState(ubicacion.state?.correo ?? '');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(ubicacion.state?.mensaje ?? '');
  // Si se llega justo después de registrarse, el primer código ya se envió: hay que esperar 60 s.
  const reenvio = useCuentaRegresiva(ubicacion.state?.enviado ? 60 : 0);
  const { iniciar } = reenvio;

  async function verificar(evento) {
    evento.preventDefault();
    if (!correo.trim() || codigo.length !== 6) {
      setError('Escriba su correo y los 6 dígitos del código.');
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const respuesta = await verificarCorreo(correo.trim(), codigo);
      navegar('/login', { replace: true, state: { mensaje: respuesta.message, correo: correo.trim() } });
    } catch (err) {
      setError(err.message);
      setCodigo('');
    } finally {
      setOcupado(false);
    }
  }

  async function reenviar() {
    if (!correo.trim()) {
      setError('Escriba su correo para enviarle un código.');
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const respuesta = await reenviarVerificacion(correo.trim());
      setAviso(respuesta.message);
      iniciar(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <MarcoAutenticacion
      titulo="Verifique su correo"
      descripcion="Escriba el código de 6 dígitos que le enviamos. Vence en 10 minutos."
      icono={MailCheck}
      pie={<Link to="/login">Volver a iniciar sesión</Link>}
    >
      <form className="formulario" onSubmit={verificar} noValidate>
        <MensajeFormulario tipo="info">{aviso}</MensajeFormulario>
        <MensajeFormulario>{error}</MensajeFormulario>
        <CampoFormulario id="correo" etiqueta="Correo" tipo="email" valor={correo} alCambiar={(_c, v) => setCorreo(v)} obligatorio maxLength={100} disabled={ocupado} />
        <CampoCodigo valor={codigo} alCambiar={setCodigo} disabled={ocupado} autoFocus={Boolean(correo)} />
        <Boton type="submit" icono={MailCheck} cargando={ocupado} disabled={codigo.length !== 6} className="boton-ancho">
          {ocupado ? 'Verificando...' : 'Verificar correo'}
        </Boton>
        <Boton variante="fantasma" icono={RotateCcw} onClick={reenviar} disabled={ocupado || reenvio.restantes > 0}>
          {reenvio.restantes > 0 ? `Reenviar en ${reenvio.restantes} s` : 'Enviarme un código nuevo'}
        </Boton>
      </form>
    </MarcoAutenticacion>
  );
}
