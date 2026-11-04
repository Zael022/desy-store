// Página de Categorías: formulario (crear/editar) + tabla (listar) + eliminar con modal.
// Las demás páginas siguen exactamente este mismo patrón.
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
import { listarCategorias, crearCategoria, actualizarCategoria, eliminarCategoria } from '../services/categoriasService.js';

const FORMULARIO_VACIO = { nombre: '', descripcion: '' };

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'total_productos', titulo: 'Productos' }
];

export default function CategoriasPage() {
  // ----- Estado de la lista -----
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [recarga, setRecarga] = useState(0); // al cambiar, se vuelve a pedir la lista

  // ----- Estado del formulario -----
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [idEditando, setIdEditando] = useState(null); // null = creando
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const refFormulario = useRef(null);

  // ----- Estado de la eliminación -----
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const ocupado = guardando || eliminando;

  // Pide la lista a la API al abrir la página y cada vez que cambia "recarga".
  useEffect(() => {
    let activo = true; // evita actualizar el estado si la página ya se cerró
    listarCategorias()
      .then((datos) => {
        if (!activo) return;
        setCategorias(datos);
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

  function empezarEdicion(categoria) {
    setIdEditando(categoria.id_categoria);
    setFormulario({ nombre: categoria.nombre, descripcion: categoria.descripcion ?? '' });
    setErrorFormulario('');
    refFormulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelarEdicion() {
    setIdEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setErrorFormulario('');
  }

  async function guardar(evento) {
    evento.preventDefault(); // evita que el navegador recargue la página
    setGuardando(true);
    setErrorFormulario('');
    const datos = { nombre: formulario.nombre, descripcion: formulario.descripcion };
    try {
      if (idEditando) {
        await actualizarCategoria(idEditando, datos);
        toast.success('Categoría actualizada correctamente.');
      } else {
        await crearCategoria(datos);
        toast.success('Categoría creada correctamente.');
      }
      cancelarEdicion(); // limpia el formulario solo si se guardó bien
      recargarLista();
    } catch (error) {
      // Si falla, el formulario conserva lo que escribió la persona.
      setErrorFormulario(error.message);
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminacion() {
    setEliminando(true);
    try {
      const respuesta = await eliminarCategoria(porEliminar.id_categoria);
      toast.success(respuesta.message);
      if (idEditando === porEliminar.id_categoria) cancelarEdicion();
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
      <EncabezadoPagina ruta={['Inventario', 'Categorías']} descripcion="Tipos de producto que vende la tienda (aretes, collares, pulseras...)." />

      <div className="disposicion-crud">
        <form ref={refFormulario} className="tarjeta formulario" onSubmit={guardar} noValidate>
          <h2>{idEditando ? 'Editar categoría' : 'Nueva categoría'}</h2>
          {errorFormulario && (
            <p className="alerta alerta-error" role="alert">
              {errorFormulario}
            </p>
          )}
          <CampoFormulario id="nombre" etiqueta="Nombre" valor={formulario.nombre} alCambiar={cambiarCampo} obligatorio maxLength={60} placeholder="Ejemplo: Tobilleras" />
          <CampoFormulario id="descripcion" etiqueta="Descripción" tipo="textarea" valor={formulario.descripcion} alCambiar={cambiarCampo} maxLength={255} />
          <div className="formulario-acciones">
            <Boton type="submit" icono={idEditando ? Save : Plus} cargando={guardando} disabled={eliminando}>
              {guardando ? 'Guardando...' : idEditando ? 'Guardar cambios' : 'Agregar categoría'}
            </Boton>
            {idEditando && (
              <Boton variante="secundario" icono={X} onClick={cancelarEdicion} disabled={guardando}>
                Cancelar
              </Boton>
            )}
          </div>
        </form>

        <section className="tarjeta" aria-labelledby="titulo-lista">
          <h2 id="titulo-lista">Lista de categorías</h2>
          {cargando ? (
            <Cargando />
          ) : errorCarga ? (
            <ErrorCarga error={errorCarga} alReintentar={reintentar} />
          ) : categorias.length === 0 ? (
            <SinRegistros />
          ) : (
            <TablaDatos
              columnas={COLUMNAS}
              filas={categorias}
              llave="id_categoria"
              idEditando={idEditando}
              ocupado={ocupado}
              nombreFila={(c) => c.nombre}
              alEditar={empezarEdicion}
              alEliminar={setPorEliminar}
            />
          )}
        </section>
      </div>

      <ModalConfirmacion
        abierto={porEliminar !== null}
        titulo="¿Eliminar esta categoría?"
        mensaje={porEliminar && `Se eliminará la categoría "${porEliminar.nombre}". Esta acción no se puede deshacer.`}
        procesando={eliminando}
        alConfirmar={confirmarEliminacion}
        alCancelar={() => setPorEliminar(null)}
      />
    </PaginaAnimada>
  );
}
