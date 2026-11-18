// Pantalla 4: segundo factor (MFA).
//   1. La persona elige el canal: correo o SMS (solo los verificados).
//   2. Se envía un código de 6 dígitos (vence en 5 minutos).
//   3. Lo escribe aquí. Si es correcto, el backend abre la sesión y nos dice
//      a qué pantalla va según el rol.
// "Reenviar" se habilita después de 60 segundos.
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Mail, MessageSquare, RotateCcw, Send, ShieldCheck } from 'lucide-react';
import MarcoAutenticacion from '../../components/MarcoAutenticacion.jsx';
import CampoCodigo from '../../components/CampoCodigo.jsx';
import Boton from '../../components/Boton.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { Cargando } from '../../components/EstadoLista.jsx';
import { enviarCodigoMfa, obtenerCanalesMfa, verificarCodigoMfa } from '../../services/authService.js';
import { useAutenticacion } from '../../hooks/useAutenticacion.js';
import { useCuentaRegresiva, formatearSegundos } from '../../hooks/useCuentaRegresiva.js';
import { INICIO_POR_ROL } from '../../context/contextoAutenticacion.js';

const NOMBRE_CANAL = { correo: 'Correo electrónico', sms: 'Mensaje de texto (SMS)' };
const ICONO_CANAL = { correo: Mail, sms: MessageSquare };

export default function MfaPage() {
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const { usuario, establecerUsuario } = useAutenticacion();
  const [canales, setCanales] = useState(ubicacion.state?.canales ?? null);
  const [canal, setCanal] = useState(ubicacion.state?.canales?.[0]?.canal ?? 'correo');
  const [enviado, setEnviado] = useState(null); // { destino, minutos }
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const reenvio = useCuentaRegresiva();
  const vigencia = useCuentaRegresiva();

  // Si se recargó la página, se vuelven a pedir los canales (con la cookie del desafío).
  useEffect(() => {
    if (canales) return;
    obtenerCanalesMfa()
      .then((datos) => {
        setCanales(datos.canales);
        setCanal(datos.canales[0]?.canal ?? 'correo');
      })
      .catch((err) => navegar('/login', { replace: true, state: { mensaje: err.message } }));
  }, [canales, navegar]);

  // Ya con sesión: vuelve a la página de donde venía (por ejemplo "Mi pedido") o a la de su rol.
  // Solo se aceptan direcciones de este mismo sitio ("/algo", nunca "//otro-sitio").
  const desde = /^\/(?!\/)/.test(ubicacion.state?.desde ?? '') ? ubicacion.state.desde : null;
  if (usuario) return <Navigate to={desde || INICIO_POR_ROL[usuario.rol]} replace />;
  if (!canales) return <Cargando texto="Preparando la verificación..." />;

  async function enviarCodigo() {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const respuesta = await enviarCodigoMfa(canal);
      setEnviado({ destino: respuesta.destino, minutos: respuesta.minutos });
      setAviso(respuesta.message);
      setCodigo('');
      reenvio.iniciar(respuesta.espera_reenvio);
      vigencia.iniciar(respuesta.minutos * 60);
    } catch (err) {
      if (err.status === 401) {
        navegar('/login', { replace: true, state: { mensaje: err.message } });
        return;
      }
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function verificar(evento) {
    evento.preventDefault();
    if (codigo.length !== 6) {
      setError('Escriba los 6 dígitos del código.');
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const respuesta = await verificarCodigoMfa(codigo);
      establecerUsuario(respuesta.usuario);
      // Si venía de una página protegida, vuelve ahí; si no, a la pantalla de su rol.
      navegar(desde || respuesta.destino, { replace: true });
    } catch (err) {
      if (err.status === 401) {
        navegar('/login', { replace: true, state: { mensaje: err.message } });
        return;
      }
      setError(err.message);
      setCodigo('');
      // 429 = se agotaron los intentos: hay que pedir otro código.
      if (err.status === 429 || /Pida un código nuevo/.test(err.message)) {
        setEnviado(null);
        vigencia.detener();
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <MarcoAutenticacion
      titulo="Verificación en dos pasos"
      descripcion={enviado ? `Escriba el código que enviamos a ${enviado.destino}.` : '¿Dónde quiere recibir su código de 6 dígitos?'}
      icono={ShieldCheck}
    >
      <MensajeFormulario tipo="exito">{aviso}</MensajeFormulario>
      <MensajeFormulario>{error}</MensajeFormulario>

      {!enviado ? (
        <div className="formulario">
          <fieldset className="opciones-canal" disabled={ocupado}>
            <legend className="sr-only">Canal para recibir el código</legend>
            {canales.map(({ canal: c, destino }) => {
              const Icono = ICONO_CANAL[c];
              return (
                <label key={c} className={canal === c ? 'opcion-canal seleccionada' : 'opcion-canal'}>
                  <input type="radio" name="canal" value={c} checked={canal === c} onChange={() => setCanal(c)} />
                  <Icono size={22} aria-hidden="true" />
                  <span>
                    <strong>{NOMBRE_CANAL[c]}</strong>
                    <small>{destino}</small>
                  </span>
                </label>
              );
            })}
          </fieldset>
          {canales.length === 1 && <p className="texto-secundario texto-pequeno">Para recibir códigos por SMS, verifique su teléfono en “Perfil y seguridad”.</p>}
          <Boton icono={Send} onClick={enviarCodigo} cargando={ocupado} className="boton-ancho">
            {ocupado ? 'Enviando...' : 'Enviar código'}
          </Boton>
        </div>
      ) : (
        <form className="formulario" onSubmit={verificar} noValidate>
          <CampoCodigo valor={codigo} alCambiar={setCodigo} disabled={ocupado} autoFocus />
          <p className="texto-secundario texto-pequeno" aria-live="polite">
            {vigencia.restantes > 0 ? `El código vence en ${formatearSegundos(vigencia.restantes)}.` : 'El código venció. Pida uno nuevo.'}
          </p>
          <Boton type="submit" icono={ShieldCheck} cargando={ocupado} disabled={codigo.length !== 6 || vigencia.restantes === 0} className="boton-ancho">
            {ocupado ? 'Verificando...' : 'Verificar y entrar'}
          </Boton>
          <div className="acciones-secundarias">
            <Boton variante="fantasma" icono={RotateCcw} onClick={enviarCodigo} disabled={ocupado || reenvio.restantes > 0}>
              {reenvio.restantes > 0 ? `Reenviar en ${reenvio.restantes} s` : 'Reenviar código'}
            </Boton>
            {canales.length > 1 && (
              <Boton variante="fantasma" onClick={() => { setEnviado(null); setAviso(''); }} disabled={ocupado}>
                Usar otro canal
              </Boton>
            )}
          </div>
        </form>
      )}
    </MarcoAutenticacion>
  );
}
