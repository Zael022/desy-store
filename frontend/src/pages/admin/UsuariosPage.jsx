// Usuarios (administración y dueña).
//   * Administración: crea, reenvía invitaciones y activa/desactiva cuentas de
//     ventas y de proveedor.
//   * Dueña: todo lo anterior para cualquier cuenta y, además, cambia los roles internos.
//   * "Editar": los datos de la persona (nombre, puesto, teléfono) se editan en
//     Empleados o Proveedores; aquí se corrige el correo de una invitación pendiente.
// Las cuentas nuevas no tienen contraseña: la persona recibe un enlace por
// correo para definirla (invitación de 48 horas).
// El backend vuelve a revisar TODAS estas reglas; aquí solo se esconden botones.
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MailPlus, Pencil, Power, PowerOff, Send, UserCog, UserPlus, X } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import TablaDatos from '../../components/TablaDatos.jsx';
import Boton from '../../components/Boton.jsx';
import Modal from '../../components/Modal.jsx';
import ModalAccion from '../../components/ModalAccion.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import MensajeFormulario from '../../components/MensajeFormulario.jsx';
import { InsigniaEstado } from '../../components/Insignias.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import { cambiarEstadoUsuario, cambiarRolUsuario, corregirCorreoUsuario, invitarUsuario, listarUsuarios, reenviarInvitacion } from '../../services/usuariosService.js';
import { listarEmpleados } from '../../services/empleadosService.js';
import { listarProveedores } from '../../services/proveedoresService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { useAutenticacion } from '../../hooks/useAutenticacion.js';
import { NOMBRES_ROLES, ROLES_INTERNOS } from '../../context/contextoAutenticacion.js';
import { formatearFechaHora } from '../../utils/formato.js';
import { PATRON_CORREO } from '../../utils/validaciones.js';

function estadoDe(u) {
  if (!u.activo) return 'inactivo';
  if (!u.tiene_contrasena && u.rol !== 'cliente') return 'invitacion';
  return 'activo';
}

function NuevaCuenta({ esDuena, usuarios, alCerrar, alCrear }) {
  const { datos, cargando, error, recargar } = useDatos(() => Promise.all([listarEmpleados(), listarProveedores()]));
  const [rol, setRol] = useState('ventas');
  const [idVinculo, setIdVinculo] = useState('');
  const [correo, setCorreo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');

  const rolesPermitidos = esDuena ? ['ventas', 'administrador', 'duena', 'proveedor'] : ['ventas', 'proveedor'];
  const esInterno = ROLES_INTERNOS.includes(rol);
  const [empleados, proveedores] = datos ?? [[], []];
  // Solo personas que todavía no tienen cuenta.
  const opciones = esInterno
    ? empleados.filter((e) => !usuarios.some((u) => u.id_empleado === e.id_empleado)).map((e) => ({ valor: String(e.id_empleado), texto: `${e.nombre} (${e.puesto})`, correo: e.correo }))
    : proveedores.filter((p) => !usuarios.some((u) => u.id_proveedor === p.id_proveedor)).map((p) => ({ valor: String(p.id_proveedor), texto: p.nombre, correo: p.correo }));

  async function guardar(evento) {
    evento.preventDefault();
    if (!idVinculo) return setErrorFormulario(esInterno ? 'Seleccione el empleado.' : 'Seleccione el proveedor.');
    if (!PATRON_CORREO.test(correo.trim())) return setErrorFormulario('Escriba un correo válido para enviar la invitación.');
    setGuardando(true);
    setErrorFormulario('');
    try {
      const respuesta = await invitarUsuario({ rol, correo: correo.trim(), ...(esInterno ? { id_empleado: Number(idVinculo) } : { id_proveedor: Number(idVinculo) }) });
      toast.success(respuesta.message);
      alCrear();
    } catch (err) {
      setErrorFormulario(err.message);
    } finally {
      setGuardando(false);
    }
    return undefined;
  }

  return (
    <Modal abierto alCerrar={alCerrar} bloqueado={guardando} idTitulo="titulo-cuenta" className="modal-formulario">
      <form className="formulario" onSubmit={guardar} noValidate>
        <h2 id="titulo-cuenta">Nueva cuenta</h2>
        <p className="texto-secundario">La persona recibirá un correo con un enlace de un solo uso para crear su contraseña (vence en 48 horas).</p>
        {cargando ? (
          <Cargando />
        ) : error ? (
          <ErrorCarga error={error} alReintentar={recargar} />
        ) : (
          <>
            <MensajeFormulario>{errorFormulario}</MensajeFormulario>
            <CampoFormulario
              id="rol"
              etiqueta="Rol"
              tipo="select"
              valor={rol}
              alCambiar={(_c, v) => {
                setRol(v);
                setIdVinculo('');
                setCorreo('');
              }}
              opciones={rolesPermitidos.map((r) => ({ valor: r, texto: NOMBRES_ROLES[r] }))}
              obligatorio
              disabled={guardando}
            />
            <CampoFormulario
              id="vinculo"
              etiqueta={esInterno ? 'Empleado' : 'Proveedor'}
              tipo="select"
              valor={idVinculo}
              alCambiar={(_c, v) => {
                setIdVinculo(v);
                setCorreo(opciones.find((o) => o.valor === v)?.correo ?? '');
              }}
              opciones={opciones}
              textoOpcionVacia={opciones.length ? 'Seleccione...' : esInterno ? 'Todos los empleados ya tienen cuenta' : 'Todos los proveedores ya tienen cuenta'}
              obligatorio
              disabled={guardando}
              ayuda={esInterno ? 'Si la persona no aparece, regístrela primero en Empleados.' : 'Si no aparece, regístrelo primero en Proveedores.'}
            />
            <CampoFormulario id="correo" etiqueta="Correo para la invitación" tipo="email" valor={correo} alCambiar={(_c, v) => setCorreo(v)} obligatorio maxLength={100} disabled={guardando} />
            <div className="formulario-acciones">
              <Boton type="submit" icono={Send} cargando={guardando}>
                {guardando ? 'Enviando invitación...' : 'Crear y enviar invitación'}
              </Boton>
              <Boton variante="secundario" icono={X} onClick={alCerrar} disabled={guardando}>
                Cancelar
              </Boton>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

export default function UsuariosPage() {
  const { usuario } = useAutenticacion();
  const esDuena = usuario.rol === 'duena';
  const { datos, cargando, error, recargar } = useDatos(listarUsuarios);
  const [filtroRol, setFiltroRol] = useState('');
  const [nueva, setNueva] = useState(false);
  const [accion, setAccion] = useState(null); // { tipo: 'estado' | 'invitacion' | 'rol' | 'correo', cuenta }
  const [rolNuevo, setRolNuevo] = useState('');
  const [correoNuevo, setCorreoNuevo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const visibles = useMemo(() => (datos ?? []).filter((u) => !filtroRol || u.rol === filtroRol), [datos, filtroRol]);

  async function confirmar() {
    setProcesando(true);
    setErrorAccion('');
    try {
      const { tipo, cuenta } = accion;
      let respuesta;
      if (tipo === 'estado') respuesta = await cambiarEstadoUsuario(cuenta.id_usuario, !cuenta.activo);
      if (tipo === 'invitacion') respuesta = await reenviarInvitacion(cuenta.id_usuario);
      if (tipo === 'rol') respuesta = await cambiarRolUsuario(cuenta.id_usuario, rolNuevo);
      if (tipo === 'correo') {
        if (!PATRON_CORREO.test(correoNuevo.trim())) throw new Error('Escriba un correo válido.');
        respuesta = await corregirCorreoUsuario(cuenta.id_usuario, correoNuevo.trim());
      }
      toast.success(respuesta.message);
      setAccion(null);
      recargar();
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  function abrir(tipo, cuenta) {
    setErrorAccion('');
    setRolNuevo(cuenta.rol);
    setCorreoNuevo(cuenta.correo);
    setAccion({ tipo, cuenta });
  }

  const columnas = [
    { clave: 'nombre', titulo: 'Nombre', mostrar: (u) => (<span>{u.nombre}{u.es_propia && <small className="texto-secundario"> (usted)</small>}</span>) },
    { clave: 'correo', titulo: 'Correo' },
    { clave: 'rol', titulo: 'Rol', mostrar: (u) => u.nombre_rol },
    { clave: 'estado', titulo: 'Estado', mostrar: (u) => <InsigniaEstado estado={estadoDe(u)} /> },
    { clave: 'ultimo_acceso', titulo: 'Último acceso', mostrar: (u) => (u.ultimo_acceso ? formatearFechaHora(u.ultimo_acceso) : 'Nunca') }
  ];

  const textos = accion && {
    estado: {
      titulo: accion.cuenta.activo ? `¿Desactivar la cuenta de ${accion.cuenta.nombre}?` : `¿Activar la cuenta de ${accion.cuenta.nombre}?`,
      mensaje: accion.cuenta.activo ? 'La persona no podrá entrar y sus sesiones abiertas se cerrarán de inmediato.' : 'La persona podrá volver a iniciar sesión.',
      confirmar: accion.cuenta.activo ? 'Sí, desactivar' : 'Sí, activar',
      variante: accion.cuenta.activo ? 'peligro' : 'primario',
      icono: accion.cuenta.activo ? PowerOff : Power
    },
    invitacion: {
      titulo: `¿Reenviar la invitación a ${accion.cuenta.correo}?`,
      mensaje: 'Se enviará un enlace nuevo (vence en 48 horas). El enlace anterior deja de servir.',
      confirmar: 'Sí, reenviar',
      variante: 'primario',
      icono: MailPlus
    },
    correo: {
      titulo: `Corregir el correo de ${accion.cuenta.nombre}`,
      mensaje: 'La invitación enviada al correo anterior deja de servir. Después, reenvíe la invitación.',
      confirmar: 'Guardar correo',
      variante: 'primario',
      icono: Pencil
    },
    rol: {
      titulo: `Cambiar el rol de ${accion.cuenta.nombre}`,
      mensaje: 'El cambio se aplica de inmediato, también en sus sesiones abiertas.',
      confirmar: 'Cambiar rol',
      variante: 'primario',
      icono: UserCog
    }
  }[accion.tipo];

  return (
    <PaginaAnimada>
      <EncabezadoPagina
        ruta={['Administración', 'Usuarios']}
        descripcion={esDuena ? 'Gestione todas las cuentas y los roles del personal.' : 'Gestione las cuentas de ventas y de proveedores. Las de administración y dueña solo las gestiona la dueña.'}
      />
      <section className="tarjeta">
        <div className="barra-acciones">
          <CampoFormulario
            id="filtro-rol"
            etiqueta="Rol"
            tipo="select"
            valor={filtroRol}
            alCambiar={(_c, v) => setFiltroRol(v)}
            textoOpcionVacia="Todos"
            opciones={Object.entries(NOMBRES_ROLES).map(([valor, texto]) => ({ valor, texto }))}
          />
          <Boton icono={UserPlus} onClick={() => setNueva(true)} disabled={!datos}>
            Nueva cuenta
          </Boton>
        </div>
        {cargando && !datos ? (
          <Cargando />
        ) : error ? (
          <ErrorCarga error={error} alReintentar={recargar} />
        ) : visibles.length === 0 ? (
          <SinRegistros texto="No hay cuentas con ese rol." />
        ) : (
          <TablaDatos
            columnas={columnas}
            filas={visibles}
            llave="id_usuario"
            acciones={(u) =>
              u.puede_gestionar ? (
                <>
                  {!u.tiene_contrasena && u.rol !== 'cliente' && (
                    <Boton variante="fantasma" icono={Pencil} onClick={() => abrir('correo', u)} aria-label={`Corregir el correo de ${u.nombre}`} title="Corregir correo de la invitación" />
                  )}
                  {!u.tiene_contrasena && u.rol !== 'cliente' && u.activo === 1 && (
                    <Boton variante="fantasma" icono={MailPlus} onClick={() => abrir('invitacion', u)} aria-label={`Reenviar invitación a ${u.nombre}`} title="Reenviar invitación" />
                  )}
                  {esDuena && ROLES_INTERNOS.includes(u.rol) && (
                    <Boton variante="fantasma" icono={UserCog} onClick={() => abrir('rol', u)} aria-label={`Cambiar el rol de ${u.nombre}`} title="Cambiar rol" />
                  )}
                  <Boton
                    variante="fantasma"
                    className={u.activo ? 'boton-eliminar' : ''}
                    icono={u.activo ? PowerOff : Power}
                    onClick={() => abrir('estado', u)}
                    aria-label={`${u.activo ? 'Desactivar' : 'Activar'} la cuenta de ${u.nombre}`}
                    title={u.activo ? 'Desactivar' : 'Activar'}
                  />
                </>
              ) : (
                <small className="texto-secundario">{u.es_propia ? 'Su cuenta' : 'Sin permiso'}</small>
              )
            }
          />
        )}
      </section>

      {nueva && (
        <NuevaCuenta
          esDuena={esDuena}
          usuarios={datos}
          alCerrar={() => setNueva(false)}
          alCrear={() => {
            setNueva(false);
            recargar();
          }}
        />
      )}

      <ModalAccion
        abierto={accion !== null}
        titulo={textos?.titulo}
        mensaje={textos?.mensaje}
        textoConfirmar={textos?.confirmar}
        variante={textos?.variante}
        icono={textos?.icono}
        procesando={procesando}
        error={errorAccion}
        deshabilitarConfirmar={(accion?.tipo === 'rol' && rolNuevo === accion?.cuenta.rol) || (accion?.tipo === 'correo' && correoNuevo.trim() === accion?.cuenta.correo)}
        alConfirmar={confirmar}
        alCancelar={() => setAccion(null)}
      >
        {accion?.tipo === 'correo' && (
          <CampoFormulario id="correo-nuevo" etiqueta="Correo correcto" tipo="email" valor={correoNuevo} alCambiar={(_c, v) => setCorreoNuevo(v)} obligatorio maxLength={100} disabled={procesando} />
        )}
        {accion?.tipo === 'rol' && (
          <CampoFormulario
            id="rol-nuevo"
            etiqueta="Rol nuevo"
            tipo="select"
            valor={rolNuevo}
            alCambiar={(_c, v) => setRolNuevo(v)}
            opciones={ROLES_INTERNOS.map((r) => ({ valor: r, texto: NOMBRES_ROLES[r] }))}
            obligatorio
            disabled={procesando}
          />
        )}
      </ModalAccion>
    </PaginaAnimada>
  );
}
