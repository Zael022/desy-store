// Página de Proveedores: mismo patrón que CategoriasPage.
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
import { listarProveedores, crearProveedor, actualizarProveedor, eliminarProveedor } from '../services/proveedoresService.js';

const FORMULARIO_VACIO = { nombre: '', contacto: '', telefono: '', correo: '', direccion: '' };

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'contacto', titulo: 'Contacto' },
  { clave: 'telefono', titulo: 'Teléfono' },
  { clave: 'correo', titulo: 'Correo' },
  { clave: 'total_productos', titulo: 'Productos' }
];

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState([]);
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
    listarProveedores()
      .then((datos) => {
        if (!activo) return;
        setProveedores(datos);
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

  function empezarEdicion(proveedor) {
    setIdEditando(proveedor.id_proveedor);
    setFormulario({
      nombre: proveedor.nombre,
      contacto: proveedor.contacto ?? '',
      telefono: proveedor.telefono,
      correo: proveedor.correo ?? '',
      direccion: proveedor.direccion ?? ''
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
        await actualizarProveedor(idEditando, formulario);
        toast.success('Proveedor actualizado correctamente.');
      } else {
        await crearProveedor(formulario);
        toast.success('Proveedor creado correctamente.');
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
      const respuesta = await eliminarProveedor(porEliminar.id_proveedor);
      toast.success(respuesta.message);
      if (idEditando === porEliminar.id_proveedor) cancelarEdicion();
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
      <EncabezadoPagina ruta={['Inventario', 'Proveedores']} descripcion="Personas o empresas a las que la tienda les compra mercadería." />

      <div className="disposicion-crud">
        <form ref={refFormulario} className="tarjeta formulario" onSubmit={guardar} noValidate>
          <h2>{idEditando ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
          {errorFormulario && (
            <p className="alerta alerta-error" role="alert">
              {errorFormulario}
            </p>
          )}
          <CampoFormulario id="nombre" etiqueta="Nombre" valor={formulario.nombre} alCambiar={cambiarCampo} obligatorio maxLength={100} />
          <CampoFormulario id="contacto" etiqueta="Persona de contacto" valor={formulario.contacto} alCambiar={cambiarCampo} maxLength={100} />
          <CampoFormulario id="telefono" etiqueta="Teléfono" tipo="tel" valor={formulario.telefono} alCambiar={cambiarCampo} obligatorio maxLength={20} placeholder="2661-0000" />
          <CampoFormulario id="correo" etiqueta="Correo" tipo="email" valor={formulario.correo} alCambiar={cambiarCampo} maxLength={100} placeholder="ventas@proveedor.com" />
          <CampoFormulario id="direccion" etiqueta="Dirección" tipo="textarea" valor={formulario.direccion} alCambiar={cambiarCampo} maxLength={255} />
          <div className="formulario-acciones">
            <Boton type="submit" icono={idEditando ? Save : Plus} cargando={guardando} disabled={eliminando}>
              {guardando ? 'Guardando...' : idEditando ? 'Guardar cambios' : 'Agregar proveedor'}
            </Boton>
            {idEditando && (
              <Boton variante="secundario" icono={X} onClick={cancelarEdicion} disabled={guardando}>
                Cancelar
              </Boton>
            )}
          </div>
        </form>

        <section className="tarjeta" aria-labelledby="titulo-lista">
          <h2 id="titulo-lista">Lista de proveedores</h2>
          {cargando ? (
            <Cargando />
          ) : errorCarga ? (
            <ErrorCarga error={errorCarga} alReintentar={reintentar} />
          ) : proveedores.length === 0 ? (
            <SinRegistros />
          ) : (
            <TablaDatos
              columnas={COLUMNAS}
              filas={proveedores}
              llave="id_proveedor"
              idEditando={idEditando}
              ocupado={ocupado}
              nombreFila={(p) => p.nombre}
              alEditar={empezarEdicion}
              alEliminar={setPorEliminar}
            />
          )}
        </section>
      </div>

      <ModalConfirmacion
        abierto={porEliminar !== null}
        titulo="¿Eliminar este proveedor?"
        mensaje={porEliminar && `Se eliminará el proveedor "${porEliminar.nombre}". Esta acción no se puede deshacer.`}
        procesando={eliminando}
        alConfirmar={confirmarEliminacion}
        alCancelar={() => setPorEliminar(null)}
      />
    </PaginaAnimada>
  );
}
