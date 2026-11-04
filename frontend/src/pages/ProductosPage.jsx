// Página de Productos con estilo de catálogo de tienda:
//   - A la izquierda, la tarjeta "Filtros" (precio, categoría, material, proveedor, disponibilidad).
//   - Arriba, "Ordenar por" y el botón "Nuevo producto".
//   - Los productos se muestran como tarjetas (lista para consultar).
//   - El formulario para crear y editar se abre en un modal.
// Los filtros, la búsqueda y el orden se aplican en el navegador sobre la lista que da la API.
// Igual que antes: NO hay campo de stock; el stock solo cambia en Movimientos.
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { FilterX, Info, Plus, Save, TriangleAlert, X } from 'lucide-react';
import PaginaAnimada from '../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../components/EncabezadoPagina.jsx';
import MigasDePan from '../components/MigasDePan.jsx';
import CampoFormulario from '../components/CampoFormulario.jsx';
import Boton from '../components/Boton.jsx';
import Modal from '../components/Modal.jsx';
import ModalConfirmacion from '../components/ModalConfirmacion.jsx';
import FiltrosProductos from '../components/FiltrosProductos.jsx';
import SelectorOrden from '../components/SelectorOrden.jsx';
import TarjetaProducto from '../components/TarjetaProducto.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../components/EstadoLista.jsx';
import { listarProductos, crearProducto, actualizarProducto, eliminarProducto } from '../services/productosService.js';
import { listarCategorias } from '../services/categoriasService.js';
import { listarProveedores } from '../services/proveedoresService.js';
import { listarMateriales } from '../services/materialesService.js';
import { obtenerConfiguracion } from '../services/configuracionService.js';
import { aNumero, normalizar } from '../utils/formato.js';
import { FILTROS_VACIOS } from '../utils/filtrosProductos.js';

const FORMULARIO_VACIO = { codigo: '', nombre: '', descripcion: '', precio: '', id_categoria: '', id_proveedor: '', id_material: '' };

const OPCIONES_ORDEN = [
  { valor: 'nombre', texto: 'Nombre (A-Z)' },
  { valor: 'precio-asc', texto: 'Precio: menor a mayor' },
  { valor: 'precio-desc', texto: 'Precio: mayor a menor' },
  { valor: 'stock-asc', texto: 'Stock: menor a mayor' },
  { valor: 'stock-desc', texto: 'Stock: mayor a menor' },
  { valor: 'recientes', texto: 'Más recientes' }
];

// Cómo comparar dos productos según la opción de "Ordenar por".
const COMPARADORES = {
  nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
  'precio-asc': (a, b) => a.precio - b.precio,
  'precio-desc': (a, b) => b.precio - a.precio,
  'stock-asc': (a, b) => a.stock - b.stock,
  'stock-desc': (a, b) => b.stock - a.stock,
  recientes: (a, b) => b.id_producto - a.id_producto
};

export default function ProductosPage() {
  // ----- Datos que vienen de la API -----
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [stockMaximo, setStockMaximo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [recarga, setRecarga] = useState(0);

  // ----- Búsqueda (viene de la cabecera: /productos?buscar=texto), filtros y orden -----
  const [parametros, setParametros] = useSearchParams();
  const busqueda = parametros.get('buscar') ?? '';
  // Si se llega con /productos?categoria=2 (desde Inicio o la ficha), esa categoría empieza marcada.
  const [filtros, setFiltros] = useState(() => {
    const categoria = Number(parametros.get('categoria'));
    return Number.isInteger(categoria) && categoria > 0 ? { ...FILTROS_VACIOS, categorias: [categoria] } : FILTROS_VACIOS;
  });
  const [orden, setOrden] = useState('nombre');

  // ----- Formulario (dentro de un modal) -----
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [idEditando, setIdEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const refPrimerCampo = useRef(null);

  // ----- Eliminación -----
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const ocupado = guardando || eliminando;

  useEffect(() => {
    let activo = true;
    Promise.all([listarProductos(), listarCategorias(), listarProveedores(), listarMateriales(), obtenerConfiguracion()])
      .then(([listaProductos, listaCategorias, listaProveedores, listaMateriales, configuracion]) => {
        if (!activo) return;
        setProductos(listaProductos);
        setCategorias(listaCategorias);
        setProveedores(listaProveedores);
        setMateriales(listaMateriales);
        setStockMaximo(configuracion.stock_maximo);
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

  // ----- Filtros -----
  function cambiarFiltro(campo, valor) {
    setFiltros((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function limpiarTodo() {
    setFiltros(FILTROS_VACIOS);
    setParametros({}); // quita ?buscar= de la dirección
  }

  // Aplica búsqueda + filtros y luego ordena. Se calcula en cada renderizado.
  const textoBuscado = normalizar(busqueda.trim());
  const precioMin = filtros.precioMin === '' ? null : Number(filtros.precioMin);
  const precioMax = filtros.precioMax === '' ? null : Number(filtros.precioMax);
  const productosVisibles = productos
    .filter((p) => !textoBuscado || normalizar(`${p.nombre} ${p.codigo} ${p.nombre_categoria} ${p.nombre_material}`).includes(textoBuscado))
    .filter((p) => precioMin === null || p.precio >= precioMin)
    .filter((p) => precioMax === null || p.precio <= precioMax)
    .filter((p) => filtros.categorias.length === 0 || filtros.categorias.includes(p.id_categoria))
    .filter((p) => filtros.materiales.length === 0 || filtros.materiales.includes(p.id_material))
    .filter((p) => filtros.proveedores.length === 0 || filtros.proveedores.includes(p.id_proveedor))
    .filter((p) => {
      if (filtros.disponibilidad === 'con-stock') return p.stock > 0;
      if (filtros.disponibilidad === 'agotados') return p.stock === 0;
      if (filtros.disponibilidad === 'casi-llenos') return stockMaximo !== null && p.stock >= stockMaximo * 0.9;
      return true;
    })
    .sort(COMPARADORES[orden]);

  // ----- Formulario -----
  function cambiarCampo(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function abrirNuevo() {
    setIdEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setErrorFormulario('');
    setFormularioAbierto(true);
  }

  function empezarEdicion(producto) {
    setIdEditando(producto.id_producto);
    // Los <select> e <input> trabajan con texto, por eso se usa String().
    setFormulario({
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      precio: String(producto.precio),
      id_categoria: String(producto.id_categoria),
      id_proveedor: String(producto.id_proveedor),
      id_material: String(producto.id_material)
    });
    setErrorFormulario('');
    setFormularioAbierto(true);
  }

  function cerrarFormulario() {
    setFormularioAbierto(false);
    setIdEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setErrorFormulario('');
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');
    // Convertimos a número lo que la API espera como número.
    const datos = {
      codigo: formulario.codigo,
      nombre: formulario.nombre,
      descripcion: formulario.descripcion,
      precio: aNumero(formulario.precio),
      id_categoria: aNumero(formulario.id_categoria),
      id_proveedor: aNumero(formulario.id_proveedor),
      id_material: aNumero(formulario.id_material)
    };
    try {
      if (idEditando) {
        await actualizarProducto(idEditando, datos);
        toast.success('Producto actualizado correctamente.');
      } else {
        await crearProducto(datos);
        toast.success('Producto creado con stock 0. Registre una entrada en Movimientos.');
      }
      cerrarFormulario(); // solo se cierra y se limpia si se guardó bien
      recargarLista();
    } catch (error) {
      // Si falla, el modal sigue abierto y conserva lo que escribió la persona.
      setErrorFormulario(error.message);
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminacion() {
    setEliminando(true);
    try {
      const respuesta = await eliminarProducto(porEliminar.id_producto);
      toast.success(respuesta.message);
      recargarLista();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  }

  const aOpciones = (lista, llave) => lista.map((item) => ({ valor: String(item[llave]), texto: item.nombre }));
  const hayFiltros = busqueda !== '' || JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS);

  return (
    <PaginaAnimada>
      {busqueda ? (
        <div className="encabezado-busqueda">
          <MigasDePan pasos={[{ texto: 'Inicio', ruta: '/' }, { texto: `Resultados de búsqueda para: '${busqueda}'` }]} />
          {!cargando && !errorCarga && <p className="resultados-encontrados">{productosVisibles.length} producto(s) encontrado(s)</p>}
        </div>
      ) : (
        <EncabezadoPagina ruta={['Inventario', 'Bisutería', 'Productos']} />
      )}

      {cargando ? (
        <div className="tarjeta">
          <Cargando />
        </div>
      ) : errorCarga ? (
        <div className="tarjeta">
          <ErrorCarga error={errorCarga} alReintentar={reintentar} />
        </div>
      ) : (
        <div className="catalogo">
          <FiltrosProductos
            filtros={filtros}
            alCambiar={cambiarFiltro}
            alLimpiar={() => setFiltros(FILTROS_VACIOS)}
            productos={productos}
            categorias={categorias}
            materiales={materiales}
            proveedores={proveedores}
          />

          <section className="catalogo-resultados" aria-labelledby="titulo-resultados">
            <div className="catalogo-barra">
              <div className="catalogo-resumen">
                <h2 id="titulo-resultados">
                  {productosVisibles.length} de {productos.length} productos
                </h2>
                {busqueda && (
                  <button type="button" className="chip" onClick={() => setParametros({})} aria-label={`Quitar la búsqueda "${busqueda}"`}>
                    Búsqueda: “{busqueda}” <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="catalogo-controles">
                <SelectorOrden valor={orden} alCambiar={setOrden} opciones={OPCIONES_ORDEN} />
                <Boton icono={Plus} onClick={abrirNuevo} disabled={ocupado}>
                  Nuevo producto
                </Boton>
              </div>
            </div>

            {productos.length === 0 ? (
              <div className="tarjeta">
                <SinRegistros texto="Todavía no hay productos. Presione “Nuevo producto” para agregar el primero." />
              </div>
            ) : productosVisibles.length === 0 ? (
              <div className="alerta alerta-advertencia alerta-sin-resultados" role="status">
                <TriangleAlert size={18} aria-hidden="true" />
                <span>No encontramos productos que coincidan con la selección.</span>
                {hayFiltros && (
                  <Boton variante="secundario" icono={FilterX} onClick={limpiarTodo}>
                    Quitar búsqueda y filtros
                  </Boton>
                )}
              </div>
            ) : (
              <div className="grilla-productos">
                <AnimatePresence>
                  {productosVisibles.map((producto, indice) => (
                    <TarjetaProducto
                      key={producto.id_producto}
                      producto={producto}
                      stockMaximo={stockMaximo}
                      indice={indice}
                      ocupado={ocupado}
                      alEditar={empezarEdicion}
                      alEliminar={setPorEliminar}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Formulario para crear o editar, dentro de un modal. */}
      <Modal abierto={formularioAbierto} alCerrar={cerrarFormulario} bloqueado={guardando} idTitulo="titulo-formulario" refFocoInicial={refPrimerCampo} className="modal-formulario">
        <form className="formulario" onSubmit={guardar} noValidate>
          <h2 id="titulo-formulario">{idEditando ? 'Editar producto' : 'Nuevo producto'}</h2>
          <p className="alerta alerta-info">
            <Info size={18} aria-hidden="true" />
            <span>
              El stock no se escribe aquí: un producto nuevo empieza en 0 y cambia con las entradas y salidas en{' '}
              <Link to="/movimientos">Movimientos</Link>
              {stockMaximo !== null && ` (máximo ${stockMaximo} unidades)`}.
            </span>
          </p>
          {errorFormulario && (
            <p className="alerta alerta-error" role="alert">
              {errorFormulario}
            </p>
          )}
          <div className="fila-campos">
            <CampoFormulario ref={refPrimerCampo} id="codigo" etiqueta="Código" valor={formulario.codigo} alCambiar={cambiarCampo} obligatorio maxLength={20} placeholder="ARE-003" />
            <CampoFormulario id="precio" etiqueta="Precio (₡)" tipo="number" min="0" step="0.01" valor={formulario.precio} alCambiar={cambiarCampo} obligatorio />
          </div>
          <CampoFormulario id="nombre" etiqueta="Nombre" valor={formulario.nombre} alCambiar={cambiarCampo} obligatorio maxLength={100} />
          <CampoFormulario id="id_categoria" etiqueta="Categoría" tipo="select" valor={formulario.id_categoria} alCambiar={cambiarCampo} opciones={aOpciones(categorias, 'id_categoria')} textoOpcionVacia="Seleccione una categoría" obligatorio />
          <CampoFormulario id="id_material" etiqueta="Material" tipo="select" valor={formulario.id_material} alCambiar={cambiarCampo} opciones={aOpciones(materiales, 'id_material')} textoOpcionVacia="Seleccione un material" obligatorio />
          <CampoFormulario id="id_proveedor" etiqueta="Proveedor" tipo="select" valor={formulario.id_proveedor} alCambiar={cambiarCampo} opciones={aOpciones(proveedores, 'id_proveedor')} textoOpcionVacia="Seleccione un proveedor" obligatorio />
          <CampoFormulario id="descripcion" etiqueta="Descripción" tipo="textarea" valor={formulario.descripcion} alCambiar={cambiarCampo} maxLength={255} />
          <div className="formulario-acciones">
            <Boton type="submit" icono={idEditando ? Save : Plus} cargando={guardando}>
              {guardando ? 'Guardando...' : idEditando ? 'Guardar cambios' : 'Agregar producto'}
            </Boton>
            <Boton variante="secundario" icono={X} onClick={cerrarFormulario} disabled={guardando}>
              Cancelar
            </Boton>
          </div>
        </form>
      </Modal>

      <ModalConfirmacion
        abierto={porEliminar !== null}
        titulo="¿Eliminar este producto?"
        mensaje={porEliminar && `Se eliminará "${porEliminar.nombre}" (${porEliminar.codigo}). Esta acción no se puede deshacer.`}
        procesando={eliminando}
        alConfirmar={confirmarEliminacion}
        alCancelar={() => setPorEliminar(null)}
      />
    </PaginaAnimada>
  );
}
