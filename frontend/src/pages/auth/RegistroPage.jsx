// Pantalla 3: Registro de clientes.
// Toda cuenta creada aquí es de CLIENTE (el backend ignora cualquier otro rol).
// Después hay que verificar el correo con un código antes del primer ingreso.
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { UserPlus } from 'lucide-react';
import MarcoAutenticacion from '../../components/MarcoAutenticacion.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import CampoContrasena from '../../components/CampoContrasena.jsx';
import Boton from '../../components/Boton.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { registrar } from '../../services/authService.js';
import { useAutenticacion } from '../../hooks/useAutenticacion.js';
import { INICIO_POR_ROL } from '../../context/contextoAutenticacion.js';
import { PATRON_CORREO, errorContrasena, errorTelefono, limpiarTelefono } from '../../utils/validaciones.js';

export default function RegistroPage() {
  const { usuario } = useAutenticacion();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ nombre: '', correo: '', telefono: '' });
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  if (usuario) return <Navigate to={INICIO_POR_ROL[usuario.rol]} replace />;

  const cambiar = (campo, valor) => setDatos((anterior) => ({ ...anterior, [campo]: valor }));

  async function enviar(evento) {
    evento.preventDefault();
    const problema =
      (!datos.nombre.trim() && 'Escriba su nombre.') ||
      (!PATRON_CORREO.test(datos.correo.trim()) && 'Escriba un correo válido (ejemplo: nombre@correo.com).') ||
      errorTelefono(datos.telefono) ||
      errorContrasena(contrasena, confirmacion);
    if (problema) {
      setError(problema);
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const respuesta = await registrar({
        nombre: datos.nombre.trim(),
        correo: datos.correo.trim(),
        contrasena,
        telefono: datos.telefono.trim() ? limpiarTelefono(datos.telefono) : undefined
      });
      navegar('/verificar-correo', { state: { correo: respuesta.correo, mensaje: respuesta.message, enviado: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAutenticacion
      titulo="Crear cuenta de cliente"
      descripcion="Con su cuenta puede ver su historial de compras en Desy. Le enviaremos un código para confirmar su correo."
      icono={UserPlus}
      pie={
        <span>
          ¿Ya tiene cuenta? <Link to="/login">Iniciar sesión</Link>
        </span>
      }
    >
      <form className="formulario" onSubmit={enviar} noValidate>
        <MensajeFormulario>{error}</MensajeFormulario>
        <CampoFormulario id="nombre" etiqueta="Nombre completo" valor={datos.nombre} alCambiar={cambiar} obligatorio maxLength={100} autoComplete="name" disabled={enviando} autoFocus />
        <CampoFormulario id="correo" etiqueta="Correo" tipo="email" valor={datos.correo} alCambiar={cambiar} obligatorio maxLength={100} autoComplete="email" disabled={enviando} />
        <CampoFormulario
          id="telefono"
          etiqueta="Teléfono (opcional)"
          tipo="tel"
          valor={datos.telefono}
          alCambiar={cambiar}
          placeholder="+506 8888 7777"
          autoComplete="tel"
          disabled={enviando}
          ayuda="Podrá verificarlo después en su perfil para recibir códigos por SMS."
        />
        <CampoContrasena id="contrasena" etiqueta="Contraseña" valor={contrasena} alCambiar={setContrasena} autoComplete="new-password" ayuda="Mínimo 8 caracteres." disabled={enviando} />
        <CampoContrasena id="confirmacion" etiqueta="Repita la contraseña" valor={confirmacion} alCambiar={setConfirmacion} autoComplete="new-password" disabled={enviando} />
        <Boton type="submit" icono={UserPlus} cargando={enviando} className="boton-ancho">
          {enviando ? 'Creando cuenta...' : 'Crear cuenta'}
        </Boton>
      </form>
    </MarcoAutenticacion>
  );
}
