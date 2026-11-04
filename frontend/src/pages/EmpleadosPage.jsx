// Página de Empleados: mismo patrón que CategoriasPage.
// Los empleados NO son usuarios (no hay login): solo se registra quién hizo cada movimiento.
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Save, X } from 'lucide-react';
import PaginaAnimada from '../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../components/EncabezadoPagina.jsx';
import CampoFormulario from '../components/CampoFormulario.jsx';
import Boton from '../components/Boton.jsx';
import TablaDatos from '../components/TablaDatos.jsx';
import ModalConfirmacion from '../components/ModalConfirmacion.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../components/EstadoLista.jsx';
import { listarEmpleados, crearEmpleado, actualizarEmpleado, eliminarEmpleado } from '../services/empleadosService.js';

const FORMULARIO_VACIO = { nombre: '', puesto: '', telefono: '', correo: '' };

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'puesto', titulo: 'Puesto' },
  { clave: 'telefono', titulo: 'Teléfono' },
  { clave: 'correo', titulo: 'Correo' },
  { clave: 'total_movimientos', titulo: 'Movimientos' }
];

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [recarga, setRecarga] = useState(0);

  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [idEditando, setIdEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const refFormulario = useRef(null);

  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const ocupado = guardando || eliminando;

  useEffect(() => {
    let activo = true;
    listarEmpleados()
      .then((datos) => {
        if (!activo) return;
        setEmpleados(datos);
        setErrorCarga(null);
      })
      .catch((error) => activo && setErrorCarga(error))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [recarga]);

  const recargarLista = () => setRecarga((n) => n + 1);

  function reintentar() {
    setCargando(true);
    recargarLista();
  }

  function cambiarCampo(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function empezarEdicion(empleado) {
    setIdEditando(empleado.id_empleado);
    setFormulario({
      nombre: empleado.nombre,
      puesto: empleado.puesto,
      telefono: empleado.telefono ?? '',
      correo: empleado.correo
    });
    setErrorFormulario('');
    refFormulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelarEdicion() {
    setIdEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setErrorFormulario('');
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');
    try {
      if (idEditando) {
        await actualizarEmpleado(idEditando, formulario);
        toast.success('Empleado actualizado correctamente.');
      } else {
        await crearEmpleado(formulario);
        toast.success('Empleado creado correctamente.');
      }
      cancelarEdicion();
      recargarLista();
    } catch (error) {
      setErrorFormulario(error.message);
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminacion() {
    setEliminando(true);
    try {
      const respuesta = await eliminarEmpleado(porEliminar.id_empleado);
      toast.success(respuesta.message);
      if (idEditando === porEliminar.id_empleado) cancelarEdicion();
      recargarLista();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  }

  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Inventario', 'Empleados']} descripcion="Personas de la tienda que registran las entradas y salidas de mercadería." />

      <div className="disposicion-crud">
        <form ref={refFormulario} className="tarjeta formulario" onSubmit={guardar} noValidate>
          <h2>{idEditando ? 'Editar empleado' : 'Nuevo empleado'}</h2>
          {errorFormulario && (
            <p className="alerta alerta-error" role="alert">
              {errorFormulario}
            </p>
          )}
          <CampoFormulario id="nombre" etiqueta="Nombre completo" valor={formulario.nombre} alCambiar={cambiarCampo} obligatorio maxLength={100} />
          <CampoFormulario id="puesto" etiqueta="Puesto" valor={formulario.puesto} alCambiar={cambiarCampo} obligatorio maxLength={60} placeholder="Ejemplo: Vendedora" />
          <CampoFormulario id="telefono" etiqueta="Teléfono" tipo="tel" valor={formulario.telefono} alCambiar={cambiarCampo} maxLength={20} placeholder="8700-0000" />
          <CampoFormulario id="correo" etiqueta="Correo" tipo="email" valor={formulario.correo} alCambiar={cambiarCampo} obligatorio maxLength={100} placeholder="nombre@tienda.com" />
          <div className="formulario-acciones">
            <Boton type="submit" icono={idEditando ? Save : Plus} cargando={guardando} disabled={eliminando}>
              {guardando ? 'Guardando...' : idEditando ? 'Guardar cambios' : 'Agregar empleado'}
            </Boton>
            {idEditando && (
              <Boton variante="secundario" icono={X} onClick={cancelarEdicion} disabled={guardando}>
                Cancelar
              </Boton>
            )}
          </div>
        </form>

        <section className="tarjeta" aria-labelledby="titulo-lista">
          <h2 id="titulo-lista">Lista de empleados</h2>
          {cargando ? (
            <Cargando />
          ) : errorCarga ? (
            <ErrorCarga error={errorCarga} alReintentar={reintentar} />
          ) : empleados.length === 0 ? (
            <SinRegistros />
          ) : (
            <TablaDatos
              columnas={COLUMNAS}
              filas={empleados}
              llave="id_empleado"
              idEditando={idEditando}
              ocupado={ocupado}
              nombreFila={(e) => e.nombre}
              alEditar={empezarEdicion}
              alEliminar={setPorEliminar}
            />
          )}
        </section>
      </div>

      <ModalConfirmacion
        abierto={porEliminar !== null}
        titulo="¿Eliminar este empleado?"
        mensaje={porEliminar && `Se eliminará a "${porEliminar.nombre}". Esta acción no se puede deshacer.`}
        procesando={eliminando}
        alConfirmar={confirmarEliminacion}
        alCancelar={() => setPorEliminar(null)}
      />
    </PaginaAnimada>
  );
}
