// Página de Materiales: mismo patrón que CategoriasPage, con una casilla de verificación.
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
import { listarMateriales, crearMaterial, actualizarMaterial, eliminarMaterial } from '../services/materialesService.js';

const FORMULARIO_VACIO = { nombre: '', es_hipoalergenico: false, descripcion: '' };

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Nombre' },
  {
    clave: 'es_hipoalergenico',
    titulo: 'Hipoalergénico',
    mostrar: (m) => <span className={m.es_hipoalergenico ? 'etiqueta etiqueta-si' : 'etiqueta'}>{m.es_hipoalergenico ? 'Sí' : 'No'}</span>
  },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'total_productos', titulo: 'Productos' }
];

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState([]);
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
    listarMateriales()
      .then((datos) => {
        if (!activo) return;
        setMateriales(datos);
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

  function empezarEdicion(material) {
    setIdEditando(material.id_material);
    setFormulario({
      nombre: material.nombre,
      es_hipoalergenico: material.es_hipoalergenico,
      descripcion: material.descripcion ?? ''
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
        await actualizarMaterial(idEditando, formulario);
        toast.success('Material actualizado correctamente.');
      } else {
        await crearMaterial(formulario);
        toast.success('Material creado correctamente.');
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
      const respuesta = await eliminarMaterial(porEliminar.id_material);
      toast.success(respuesta.message);
      if (idEditando === porEliminar.id_material) cancelarEdicion();
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
      <EncabezadoPagina ruta={['Inventario', 'Materiales']} descripcion="De qué están hechos los productos y si son aptos para personas alérgicas." />

      <div className="disposicion-crud">
        <form ref={refFormulario} className="tarjeta formulario" onSubmit={guardar} noValidate>
          <h2>{idEditando ? 'Editar material' : 'Nuevo material'}</h2>
          {errorFormulario && (
            <p className="alerta alerta-error" role="alert">
              {errorFormulario}
            </p>
          )}
          <CampoFormulario id="nombre" etiqueta="Nombre" valor={formulario.nombre} alCambiar={cambiarCampo} obligatorio maxLength={60} placeholder="Ejemplo: Plata 925" />
          <div className="campo campo-casilla">
            <input
              id="es_hipoalergenico"
              type="checkbox"
              checked={formulario.es_hipoalergenico}
              onChange={(evento) => cambiarCampo('es_hipoalergenico', evento.target.checked)}
            />
            <label htmlFor="es_hipoalergenico">Es hipoalergénico (apto para personas alérgicas)</label>
          </div>
          <CampoFormulario id="descripcion" etiqueta="Descripción" tipo="textarea" valor={formulario.descripcion} alCambiar={cambiarCampo} maxLength={255} />
          <div className="formulario-acciones">
            <Boton type="submit" icono={idEditando ? Save : Plus} cargando={guardando} disabled={eliminando}>
              {guardando ? 'Guardando...' : idEditando ? 'Guardar cambios' : 'Agregar material'}
            </Boton>
            {idEditando && (
              <Boton variante="secundario" icono={X} onClick={cancelarEdicion} disabled={guardando}>
                Cancelar
              </Boton>
            )}
          </div>
        </form>

        <section className="tarjeta" aria-labelledby="titulo-lista">
          <h2 id="titulo-lista">Lista de materiales</h2>
          {cargando ? (
            <Cargando />
          ) : errorCarga ? (
            <ErrorCarga error={errorCarga} alReintentar={reintentar} />
          ) : materiales.length === 0 ? (
            <SinRegistros />
          ) : (
            <TablaDatos
              columnas={COLUMNAS}
              filas={materiales}
              llave="id_material"
              idEditando={idEditando}
              ocupado={ocupado}
              nombreFila={(m) => m.nombre}
              alEditar={empezarEdicion}
              alEliminar={setPorEliminar}
            />
          )}
        </section>
      </div>

      <ModalConfirmacion
        abierto={porEliminar !== null}
        titulo="¿Eliminar este material?"
        mensaje={porEliminar && `Se eliminará el material "${porEliminar.nombre}". Esta acción no se puede deshacer.`}
        procesando={eliminando}
        alConfirmar={confirmarEliminacion}
        alCancelar={() => setPorEliminar(null)}
      />
    </PaginaAnimada>
  );
}
