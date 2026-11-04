// Página de inicio con estilo de tienda:
//   - Carrusel de anuncios (con datos reales del inventario).
//   - "Nuestras categorías" (como la fila de marcas de una tienda): cada una abre el catálogo filtrado.
//   - "Productos con poco stock" (los que conviene reponer primero).
//   - Resumen en tarjetas y gráfico de stock por producto.
// Todos los números salen de la API (nada está escrito a mano).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, Boxes, Package, PackageX, Warehouse } from 'lucide-react';
import PaginaAnimada from '../components/PaginaAnimada.jsx';
import CarruselAnuncios from '../components/CarruselAnuncios.jsx';
import FilaDeslizable from '../components/FilaDeslizable.jsx';
import TarjetaProducto from '../components/TarjetaProducto.jsx';
import GraficoStock from '../components/GraficoStock.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../components/EstadoLista.jsx';
import { listarProductos } from '../services/productosService.js';
import { listarCategorias } from '../services/categoriasService.js';
import { obtenerConfiguracion } from '../services/configuracionService.js';
import IconoCategoria from '../components/IconoCategoria.jsx';
import { fondoDeCategoria } from '../utils/fondosCategoria.js';

function TarjetaResumen({ icono: Icono, titulo, valor, detalle, indice }) {
  return (
    <motion.article
      className="tarjeta tarjeta-resumen"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.08 * indice } }}
    >
      <span className="resumen-icono" aria-hidden="true">
        <Icono size={22} />
      </span>
      <div>
        <p className="resumen-titulo">{titulo}</p>
        <p className="resumen-valor">{valor}</p>
        {detalle && <p className="resumen-detalle">{detalle}</p>}
      </div>
    </motion.article>
  );
}

// Una categoría como "logo" en la fila de categorías.
function TarjetaCategoria({ categoria }) {
  return (
    <Link to={`/productos?categoria=${categoria.id_categoria}`} className="tarjeta-categoria">
      <span className={`categoria-icono ${fondoDeCategoria(categoria.id_categoria)}`} aria-hidden="true">
        <IconoCategoria nombre={categoria.nombre} size={28} strokeWidth={1.6} />
      </span>
      <span className="categoria-nombre">{categoria.nombre}</span>
      <span className="categoria-cantidad">{categoria.total_productos} producto(s)</span>
    </Link>
  );
}

export default function InicioPage() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [stockMaximo, setStockMaximo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    Promise.all([listarProductos(), listarCategorias(), obtenerConfiguracion()])
      .then(([listaProductos, listaCategorias, configuracion]) => {
        if (!activo) return;
        setProductos(listaProductos);
        setCategorias(listaCategorias);
        setStockMaximo(configuracion.stock_maximo);
        setErrorCarga(null);
      })
      .catch((error) => activo && setErrorCarga(error))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [recarga]);

  function reintentar() {
    setCargando(true);
    setRecarga((n) => n + 1);
  }

  if (cargando || errorCarga || productos.length === 0) {
    return (
      <PaginaAnimada>
        <div className="tarjeta">
          {cargando ? (
            <Cargando />
          ) : errorCarga ? (
            <ErrorCarga error={errorCarga} alReintentar={reintentar} />
          ) : (
            <SinRegistros texto="Todavía no hay productos. Ejecute el seed o agregue productos en la página Productos." />
          )}
        </div>
      </PaginaAnimada>
    );
  }

  // Cálculos a partir de los productos reales.
  const unidades = productos.reduce((total, p) => total + p.stock, 0);
  const agotados = productos.filter((p) => p.stock === 0);
  const casiLlenos = productos.filter((p) => p.stock >= stockMaximo * 0.9);
  const pocoStock = [...productos].sort((a, b) => a.stock - b.stock).slice(0, 8);

  const anuncios = [
    {
      titulo: 'Desy · Inventario al día',
      texto: `${productos.length} productos y ${unidades} unidades en Desy.`,
      ruta: '/productos',
      textoBoton: 'Ver catálogo',
      estilo: 'cafe'
    },
    {
      titulo: agotados.length > 0 ? `${agotados.length} producto(s) agotado(s)` : 'Ningún producto agotado',
      texto: agotados.length > 0 ? `Reponga ${agotados.map((p) => p.nombre).join(', ')} registrando una entrada.` : 'Todo el catálogo tiene unidades disponibles.',
      ruta: '/movimientos',
      textoBoton: 'Registrar movimiento',
      estilo: 'verde'
    },
    {
      titulo: `Máximo ${stockMaximo} unidades por producto`,
      texto: `${casiLlenos.length} producto(s) ya tienen el 90 % o más del espacio disponible.`,
      ruta: '/productos',
      textoBoton: 'Revisar stock',
      estilo: 'miel'
    }
  ];

  return (
    <PaginaAnimada>
      <CarruselAnuncios anuncios={anuncios} />

      <FilaDeslizable titulo="Nuestras categorías">
        {categorias.map((categoria) => (
          <TarjetaCategoria key={categoria.id_categoria} categoria={categoria} />
        ))}
      </FilaDeslizable>

      <FilaDeslizable
        titulo="Productos con poco stock"
        accion={
          <Link to="/productos" className="enlace-ver-mas">
            Ver todos <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      >
        {pocoStock.map((producto, indice) => (
          <TarjetaProducto key={producto.id_producto} producto={producto} stockMaximo={stockMaximo} indice={indice} compacta />
        ))}
      </FilaDeslizable>

      <div className="grilla-resumen">
        <TarjetaResumen indice={0} icono={Package} titulo="Productos" valor={productos.length} detalle="en el catálogo" />
        <TarjetaResumen indice={1} icono={Boxes} titulo="Unidades en stock" valor={unidades} detalle="sumando todos los productos" />
        <TarjetaResumen indice={2} icono={PackageX} titulo="Agotados" valor={agotados.length} detalle={agotados.length ? agotados.map((p) => p.codigo).join(', ') : 'ninguno'} />
        <TarjetaResumen indice={3} icono={Warehouse} titulo="Casi llenos" valor={casiLlenos.length} detalle={`con 90 % o más de ${stockMaximo}`} />
      </div>

      <section className="tarjeta" aria-labelledby="titulo-grafico">
        <h2 id="titulo-grafico">Stock por producto</h2>
        <p className="texto-secundario">
          Cada barra es el stock actual de un producto. La línea punteada marca el máximo de {stockMaximo} unidades. Para cambiar el stock registre un movimiento en{' '}
          <Link to="/movimientos">Movimientos</Link>.
        </p>
        <GraficoStock productos={productos} stockMaximo={stockMaximo} />
      </section>
    </PaginaAnimada>
  );
}
