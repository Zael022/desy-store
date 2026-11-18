// Catálogo público: búsqueda, filtros (precio, categoría con subcategorías, material y
// disponibilidad) y orden. Nunca muestra el stock exacto, costos ni proveedores.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AnimatePresence } from 'motion/react';
import { FilterX, TriangleAlert, X } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import MigasDePan from '../../components/MigasDePan.jsx';
import FiltrosProductos from '../../components/FiltrosProductos.jsx';
import SelectorOrden from '../../components/SelectorOrden.jsx';
import TarjetaProducto from '../../components/TarjetaProducto.jsx';
import Boton from '../../components/Boton.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import { listarCatalogo, obtenerFiltrosCatalogo } from '../../services/catalogoService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { normalizar } from '../../utils/formato.js';
import { FILTROS_VACIOS, OPCIONES_CATALOGO } from '../../utils/filtrosProductos.js';
import { idsIncluidos } from '../../utils/categorias.js';

const OPCIONES_ORDEN = [
  { valor: 'nombre', texto: 'Nombre (A-Z)' },
  { valor: 'precio-asc', texto: 'Precio: menor a mayor' },
  { valor: 'precio-desc', texto: 'Precio: mayor a menor' },
  { valor: 'recientes', texto: 'Más recientes' }
];
const COMPARADORES = {
  nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
  'precio-asc': (a, b) => a.precio - b.precio,
  'precio-desc': (a, b) => b.precio - a.precio,
  recientes: (a, b) => b.id_producto - a.id_producto
};

export default function CatalogoPage() {
  const { datos, cargando, error, recargar } = useDatos(() => Promise.all([listarCatalogo(), obtenerFiltrosCatalogo()]));
  const [parametros, setParametros] = useSearchParams();
  const busqueda = parametros.get('buscar') ?? '';
  const [filtros, setFiltros] = useState(() => {
    const categoria = Number(parametros.get('categoria'));
    return Number.isInteger(categoria) && categoria > 0 ? { ...FILTROS_VACIOS, categorias: [categoria] } : FILTROS_VACIOS;
  });
  const [orden, setOrden] = useState('nombre');

  const [productos, opciones] = datos ?? [[], { categorias: [], materiales: [] }];
  const texto = normalizar(busqueda.trim());
  const minimo = filtros.precioMin === '' ? null : Number(filtros.precioMin);
  const maximo = filtros.precioMax === '' ? null : Number(filtros.precioMax);
  const categoriasElegidas = idsIncluidos(filtros.categorias, opciones.categorias); // "Crochet" incluye sus subcategorías
  const visibles = productos
    .filter((p) => !texto || normalizar(`${p.nombre} ${p.codigo} ${p.nombre_categoria} ${p.nombre_categoria_padre ?? ''} ${p.nombre_material}`).includes(texto))
    .filter((p) => minimo === null || p.precio >= minimo)
    .filter((p) => maximo === null || p.precio <= maximo)
    .filter((p) => filtros.categorias.length === 0 || categoriasElegidas.has(p.id_categoria))
    .filter((p) => filtros.materiales.length === 0 || filtros.materiales.includes(p.id_material))
    .filter((p) => filtros.disponibilidad === 'todos' || p.disponibilidad === filtros.disponibilidad)
    .sort(COMPARADORES[orden]);
  const hayFiltros = busqueda !== '' || JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS);

  return (
    <PaginaAnimada>
      {busqueda ? (
        <div className="encabezado-busqueda">
          <MigasDePan pasos={[{ texto: 'Inicio', ruta: '/' }, { texto: 'Catálogo', ruta: '/catalogo' }, { texto: `Resultados para: '${busqueda}'` }]} />
        </div>
      ) : (
        <EncabezadoPagina ruta={['Desy', 'Catálogo']} descripcion={opciones.mensaje_catalogo} />
      )}

      {cargando ? (
        <div className="tarjeta"><Cargando /></div>
      ) : error ? (
        <div className="tarjeta"><ErrorCarga error={error} alReintentar={recargar} /></div>
      ) : (
        <div className="catalogo">
          <FiltrosProductos
            filtros={filtros}
            alCambiar={(campo, valor) => setFiltros((anterior) => ({ ...anterior, [campo]: valor }))}
            alLimpiar={() => setFiltros(FILTROS_VACIOS)}
            productos={productos}
            categorias={opciones.categorias}
            materiales={opciones.materiales}
            opcionesDisponibilidad={OPCIONES_CATALOGO}
          />
          <section className="catalogo-resultados" aria-labelledby="titulo-resultados">
            <div className="catalogo-barra">
              <div className="catalogo-resumen">
                <h2 id="titulo-resultados">
                  {visibles.length} de {productos.length} productos
                </h2>
                {busqueda && (
                  <button type="button" className="chip" onClick={() => setParametros({})} aria-label={`Quitar la búsqueda "${busqueda}"`}>
                    Búsqueda: “{busqueda}” <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="catalogo-controles">
                <SelectorOrden valor={orden} alCambiar={setOrden} opciones={OPCIONES_ORDEN} />
              </div>
            </div>
            {productos.length === 0 ? (
              <div className="tarjeta"><SinRegistros texto="Todavía no hay productos en el catálogo." /></div>
            ) : visibles.length === 0 ? (
              <div className="alerta alerta-advertencia alerta-sin-resultados" role="status">
                <TriangleAlert size={18} aria-hidden="true" />
                <span>No encontramos productos que coincidan con la selección.</span>
                {hayFiltros && (
                  <Boton variante="secundario" icono={FilterX} onClick={() => { setFiltros(FILTROS_VACIOS); setParametros({}); }}>
                    Quitar búsqueda y filtros
                  </Boton>
                )}
              </div>
            ) : (
              <div className="grilla-productos">
                <AnimatePresence>
                  {visibles.map((producto, indice) => (
                    <TarjetaProducto key={producto.id_producto} producto={producto} indice={indice} publico rutaBase="/catalogo" />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>
      )}
    </PaginaAnimada>
  );
}
