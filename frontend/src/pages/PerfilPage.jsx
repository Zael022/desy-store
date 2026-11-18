// Pantalla 11: Perfil y seguridad (todas las cuentas).
//   * Datos personales (el cliente puede editar nombre y dirección).
//   * Canales verificados para el código MFA: correo y teléfono (SMS).
//   * Cambiar teléfono o correo (con un código al nuevo destino).
//   * Cambiar contraseña (pide la actual; cierra las demás sesiones).
//   * Sesiones abiertas y "cerrar las demás".
import { useState } from 'react';
import toast from 'react-hot-toast';
import { CircleCheck, CircleX, KeyRound, LogOut, Mail, MonitorSmartphone, Phone, Save, Send, ShieldCheck, UserRound } from 'lucide-react';
import PaginaAnimada from '../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../components/EncabezadoPagina.jsx';
import CampoFormulario from '../components/CampoFormulario.jsx';
import CampoContrasena from '../components/CampoContrasena.jsx';
import CampoCodigo from '../components/CampoCodigo.jsx';
import Boton from '../components/Boton.jsx';
import MensajeFormulario from '../components/MensajeFormulario.jsx';
import ModalAccion from '../components/ModalAccion.jsx';
import { Cargando, ErrorCarga } from '../components/EstadoLista.jsx';
import * as perfilService from '../services/perfilService.js';
import { useDatos } from '../hooks/useDatos.js';
import { useAutenticacion } from '../hooks/useAutenticacion.js';
import { NOMBRES_ROLES } from '../context/contextoAutenticacion.js';
import { formatearFechaHora } from '../utils/formato.js';
import { PATRON_CORREO, errorContrasena, errorTelefono, limpiarTelefono } from '../utils/validaciones.js';

function DatosCliente({ perfil, alGuardar }) {
  const [datos, setDatos] = useState({ nombre: perfil.nombre ?? '', direccion: perfil.direccion ?? '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await perfilService.actualizarDatos(datos);
      toast.success('Datos actualizados.');
      alGuardar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }
  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      <MensajeFormulario>{error}</MensajeFormulario>
      <CampoFormulario id="nombre" etiqueta="Nombre" valor={datos.nombre} alCambiar={(c, v) => setDatos({ ...datos, [c]: v })} obligatorio maxLength={100} disabled={guardando} />
      <CampoFormulario id="direccion" etiqueta="Dirección" tipo="textarea" valor={datos.direccion} alCambiar={(c, v) => setDatos({ ...datos, [c]: v })} maxLength={255} disabled={guardando} />
      <Boton type="submit" icono={Save} cargando={guardando}>
        {guardando ? 'Guardando...' : 'Guardar datos'}
      </Boton>
    </form>
  );
}

// Formulario en dos pasos: 1) pedir el código  2) escribirlo.
function CambioConCodigo({ tipo, alTerminar }) {
  const esTelefono = tipo === 'telefono';
  const [valor, setValor] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [codigo, setCodigo] = useState('');
  const [paso, setPaso] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function pedir(evento) {
    evento.preventDefault();
    const problema = esTelefono ? errorTelefono(valor) || (!valor.trim() && 'Escriba su teléfono.') : !PATRON_CORREO.test(valor.trim()) ? 'Escriba un correo válido.' : !contrasena ? 'Escriba su contraseña actual.' : '';
    if (problema) {
      setError(problema);
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const respuesta = esTelefono ? await perfilService.pedirVerificacionTelefono(limpiarTelefono(valor)) : await perfilService.pedirCambioCorreo(valor.trim(), contrasena);
      setAviso(respuesta.message);
      setContrasena('');
      setPaso(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setError('');
    try {
      const respuesta = esTelefono ? await perfilService.confirmarTelefono(codigo) : await perfilService.confirmarCambioCorreo(codigo);
      toast.success(respuesta.message);
      alTerminar();
    } catch (err) {
      setError(err.message);
      setCodigo('');
    } finally {
      setOcupado(false);
    }
  }

  return paso === 1 ? (
    <form className="formulario" onSubmit={pedir} noValidate>
      <MensajeFormulario>{error}</MensajeFormulario>
      {esTelefono ? (
        <CampoFormulario id="telefono-nuevo" etiqueta="Teléfono (formato internacional)" tipo="tel" valor={valor} alCambiar={(_c, v) => setValor(v)} placeholder="+506 8888 7777" disabled={ocupado} ayuda="Le enviaremos un SMS con un código. Con Twilio de prueba, el número debe estar verificado en Twilio." />
      ) : (
        <>
          <CampoFormulario id="correo-nuevo" etiqueta="Correo nuevo" tipo="email" valor={valor} alCambiar={(_c, v) => setValor(v)} maxLength={100} disabled={ocupado} />
          <CampoContrasena id="contrasena-correo" etiqueta="Contraseña actual" valor={contrasena} alCambiar={setContrasena} disabled={ocupado} />
        </>
      )}
      <Boton type="submit" icono={Send} cargando={ocupado}>
        {ocupado ? 'Enviando...' : 'Enviar código'}
      </Boton>
    </form>
  ) : (
    <form className="formulario" onSubmit={confirmar} noValidate>
      <MensajeFormulario tipo="exito">{aviso}</MensajeFormulario>
      <MensajeFormulario>{error}</MensajeFormulario>
      <CampoCodigo id={`codigo-${tipo}`} valor={codigo} alCambiar={setCodigo} disabled={ocupado} autoFocus />
      <div className="formulario-acciones">
        <Boton type="submit" icono={ShieldCheck} cargando={ocupado} disabled={codigo.length !== 6}>
          {ocupado ? 'Verificando...' : 'Confirmar'}
        </Boton>
        <Boton variante="secundario" onClick={() => setPaso(1)} disabled={ocupado}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

function CambioContrasena() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function guardar(evento) {
    evento.preventDefault();
    const problema = (!actual && 'Escriba su contraseña actual.') || errorContrasena(nueva, confirmacion);
    if (problema) {
      setError(problema);
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const respuesta = await perfilService.cambiarContrasena(actual, nueva);
      toast.success(respuesta.message);
      setActual('');
      setNueva('');
      setConfirmacion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      <MensajeFormulario>{error}</MensajeFormulario>
      <CampoContrasena id="actual" etiqueta="Contraseña actual" valor={actual} alCambiar={setActual} disabled={ocupado} />
      <CampoContrasena id="nueva" etiqueta="Contraseña nueva" valor={nueva} alCambiar={setNueva} autoComplete="new-password" ayuda="Mínimo 8 caracteres. Se cerrarán sus sesiones en otros dispositivos." disabled={ocupado} />
      <CampoContrasena id="confirmacion" etiqueta="Repita la contraseña nueva" valor={confirmacion} alCambiar={setConfirmacion} autoComplete="new-password" disabled={ocupado} />
      <Boton type="submit" icono={KeyRound} cargando={ocupado}>
        {ocupado ? 'Cambiando...' : 'Cambiar contraseña'}
      </Boton>
    </form>
  );
}

function Sesiones() {
  const { datos, cargando, error, recargar } = useDatos(perfilService.listarSesiones);
  const [confirmando, setConfirmando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  async function cerrarOtras() {
    setProcesando(true);
    try {
      const respuesta = await perfilService.cerrarOtrasSesiones();
      toast.success(respuesta.message);
      setConfirmando(false);
      recargar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcesando(false);
    }
  }

  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;
  return (
    <>
      <ul className="lista-sesiones">
        {datos.map((s) => (
          <li key={s.id_sesion}>
            <MonitorSmartphone size={20} aria-hidden="true" />
            <span>
              <strong>{s.actual ? 'Este dispositivo' : s.agente?.split(' ')[0] ?? 'Navegador'}</strong>
              <small>
                Inicio: {formatearFechaHora(s.creada_en)} · Última actividad: {formatearFechaHora(s.ultima_actividad)} · IP {s.ip ?? '—'}
              </small>
            </span>
          </li>
        ))}
      </ul>
      <Boton variante="secundario" icono={LogOut} onClick={() => setConfirmando(true)} disabled={datos.length <= 1}>
        Cerrar las demás sesiones
      </Boton>
      <ModalAccion
        abierto={confirmando}
        titulo="¿Cerrar las demás sesiones?"
        mensaje="Se cerrará su cuenta en todos los otros navegadores y dispositivos. Esta sesión seguirá abierta."
        textoConfirmar="Sí, cerrarlas"
        variante="peligro"
        icono={LogOut}
        procesando={procesando}
        textoProcesando="Cerrando..."
        alConfirmar={cerrarOtras}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}

export default function PerfilPage() {
  const { recargarSesion, cerrarSesion } = useAutenticacion();
  const { datos: perfil, cargando, error, recargar } = useDatos(perfilService.obtenerPerfil);
  const [cambio, setCambio] = useState(null); // 'correo' | 'telefono' | null

  if (cargando) return <Cargando texto="Cargando su perfil..." />;
  if (error) return <div className="pagina tarjeta"><ErrorCarga error={error} alReintentar={recargar} /></div>;

  function terminarCambio() {
    setCambio(null);
    recargar();
    recargarSesion();
  }

  const correo = perfil.canales.find((c) => c.canal === 'correo');
  const sms = perfil.canales.find((c) => c.canal === 'sms');

  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Mi cuenta', 'Perfil y seguridad']} descripcion="Revise sus datos, los lugares donde recibe el código de verificación y sus sesiones abiertas." />
      <div className="grilla-perfil">
        <section className="tarjeta" aria-labelledby="titulo-datos">
          <h2 id="titulo-datos"><UserRound size={20} aria-hidden="true" /> Mis datos</h2>
          <dl className="lista-datos">
            <dt>Nombre</dt>
            <dd>{perfil.nombre}</dd>
            <dt>Rol</dt>
            <dd>{NOMBRES_ROLES[perfil.rol]}</dd>
            <dt>Correo</dt>
            <dd>{perfil.correo}</dd>
          </dl>
          {perfil.rol === 'cliente' && <DatosCliente perfil={perfil} alGuardar={() => { recargar(); recargarSesion(); }} />}
        </section>

        <section className="tarjeta" aria-labelledby="titulo-canales">
          <h2 id="titulo-canales"><ShieldCheck size={20} aria-hidden="true" /> Verificación en dos pasos</h2>
          <p className="texto-secundario">Cada vez que inicia sesión le pedimos un código que llega a uno de estos lugares.</p>
          <ul className="lista-canales">
            <li>
              <Mail size={20} aria-hidden="true" />
              <span><strong>Correo</strong><small>{correo.destino}</small></span>
              {correo.verificado ? <span className="insignia insignia-disponible"><CircleCheck size={14} aria-hidden="true" /> Verificado</span> : <span className="insignia insignia-agotado"><CircleX size={14} aria-hidden="true" /> Sin verificar</span>}
              <Boton variante="fantasma" onClick={() => setCambio(cambio === 'correo' ? null : 'correo')}>Cambiar</Boton>
            </li>
            <li>
              <Phone size={20} aria-hidden="true" />
              <span><strong>Teléfono (SMS)</strong><small>{sms.destino ?? 'Sin teléfono'}</small></span>
              {sms.verificado ? <span className="insignia insignia-disponible"><CircleCheck size={14} aria-hidden="true" /> Verificado</span> : <span className="insignia insignia-pocas"><CircleX size={14} aria-hidden="true" /> Sin verificar</span>}
              <Boton variante="fantasma" onClick={() => setCambio(cambio === 'telefono' ? null : 'telefono')}>{sms.verificado ? 'Cambiar' : 'Verificar'}</Boton>
            </li>
          </ul>
          {cambio && (
            <div className="caja-cambio">
              <h3>{cambio === 'correo' ? 'Cambiar correo' : 'Verificar teléfono'}</h3>
              <CambioConCodigo key={cambio} tipo={cambio} alTerminar={terminarCambio} />
            </div>
          )}
        </section>

        <section className="tarjeta" aria-labelledby="titulo-contrasena">
          <h2 id="titulo-contrasena"><KeyRound size={20} aria-hidden="true" /> Cambiar contraseña</h2>
          <CambioContrasena />
        </section>

        <section className="tarjeta" aria-labelledby="titulo-sesiones">
          <h2 id="titulo-sesiones"><MonitorSmartphone size={20} aria-hidden="true" /> Sesiones abiertas</h2>
          <Sesiones />
          <hr className="separador" />
          <Boton variante="peligro" icono={LogOut} onClick={cerrarSesion}>
            Cerrar sesión en este dispositivo
          </Boton>
        </section>
      </div>
    </PaginaAnimada>
  );
}
