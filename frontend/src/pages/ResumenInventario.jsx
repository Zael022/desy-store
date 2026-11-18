// Resumen del inventario (la antigua página de inicio, ahora dentro del Panel administrativo):
//   - Carrusel de anuncios (con datos reales del inventario).
//   - "Nuestras categorías" (como la fila de marcas de una tienda): cada una abre el catálogo filtrado.
//   - "Productos con poco stock" (los que conviene reponer primero).
//   - Resumen en tarjetas y gráfico de stock por producto.
// Todos los números salen de la API (nada está escrito a mano).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Boxes, Package, PackageX, Warehouse } from 'lucide-react';
import TarjetaResumen from '../components/TarjetaResumen.jsx';
import CarruselAnuncios from '../components/CarruselAnuncios.jsx';
import FilaDeslizable from '../components/FilaDeslizable.jsx';
import TarjetaProducto from '../components/TarjetaProducto.jsx';
import GraficoStock from '../components/GraficoStock.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../components/EstadoLista.jsx';
import { listarProductos } from '../services/productosService.js';
import { listarCategorias } from '../services/categoriasService.js';
import { obtenerConfiguracion } from '../services/configuracionService.js';
import FotoProducto from '../components/FotoProducto.jsx';
import { fondoDeCategoria } from '../utils/fondosCategoria.js';
import { contarProductos, idsIncluidos } from '../utils/categorias.js';

// Una categoría principal como "logo" en la fila de categorías (cuenta también sus subcategorías).
function TarjetaCategoria({ categoria, productos, categorias }) {
  const ids = idsIncluidos([categoria.id_categoria], categorias);
  const foto = productos.find((p) => ids.has(p.id_categoria) && p.foto_principal)?.foto_principal ?? null;
  return (
    <Link to={`/admin/productos?categoria=${categoria.id_categoria}`} className="tarjeta-categoria">
      <span className={`categoria-icono ${foto ? 'con-foto' : fondoDeCategoria(categoria.id_categoria)}`} aria-hidden="true">
        <FotoProducto archivo={foto} alt="" nombreCategoria={categoria.nombre} tamanoIcono={28} />
      </span>
      <span className="categoria-nombre">{categoria.nombre}</span>
      <span className="categoria-cantidad">{contarProductos(productos, categoria.id_categoria, categorias)} producto(s)</span>
    </Link>
  );
}

export default function ResumenInventario() {
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
      <div className="tarjeta">
          {cargando ? (
            <Cargando />
          ) : errorCarga ? (
            <ErrorCarga error={errorCarga} alReintentar={reintentar} />
          ) : (
            <SinRegistros texto="Todavía no hay productos. Ejecute el seed o agregue productos en la página Productos." />
          )}
      </div>
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
      ruta: '/admin/productos',
      textoBoton: 'Ver catálogo',
      estilo: 'cafe'
    },
    {
      titulo: agotados.length > 0 ? `${agotados.length} producto(s) agotado(s)` : 'Ningún producto agotado',
      texto: agotados.length > 0 ? `Reponga ${agotados.map((p) => p.nombre).join(', ')} registrando una entrada.` : 'Todo el catálogo tiene unidades disponibles.',
      ruta: '/admin/movimientos',
      textoBoton: 'Registrar movimiento',
      estilo: 'verde'
    },
    {
      titulo: `Máximo ${stockMaximo} unidades por producto`,
      texto: `${casiLlenos.length} producto(s) ya tienen el 90 % o más del espacio disponible.`,
      ruta: '/admin/productos',
      textoBoton: 'Revisar stock',
      estilo: 'miel'
    }
  ];

  return (
    <>
      <CarruselAnuncios anuncios={anuncios} />

      <FilaDeslizable titulo="Nuestras categorías">
        {categorias.filter((c) => !c.id_categoria_padre).map((categoria) => (
          <TarjetaCategoria key={categoria.id_categoria} categoria={categoria} productos={productos} categorias={categorias} />
        ))}
      </FilaDeslizable>

      <FilaDeslizable
        titulo="Productos con poco stock"
        accion={
          <Link to="/admin/productos" className="enlace-ver-mas">
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
          <Link to="/admin/movimientos">Movimientos</Link>.
        </p>
        <GraficoStock productos={productos} stockMaximo={stockMaximo} />
      </section>
    </>
  );
}
