// Pantalla 1: Bienvenida (pública). Se ve como la portada de una tienda:
// anuncios, categorías y productos del catálogo (con disponibilidad, sin stock exacto).
import { Link } from 'react-router';
import { ArrowRight, LogIn, Store, UserPlus } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import CarruselAnuncios from '../../components/CarruselAnuncios.jsx';
import FilaDeslizable from '../../components/FilaDeslizable.jsx';
import TarjetaProducto from '../../components/TarjetaProducto.jsx';
import FotoProducto from '../../components/FotoProducto.jsx';
import { Cargando, ErrorCarga } from '../../components/EstadoLista.jsx';
import { listarCatalogo, obtenerFiltrosCatalogo } from '../../services/catalogoService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { useAutenticacion } from '../../hooks/useAutenticacion.js';
import { INICIO_POR_ROL, NOMBRES_ROLES } from '../../context/contextoAutenticacion.js';
import { fondoDeCategoria } from '../../utils/fondosCategoria.js';
import { contarProductos, idsIncluidos } from '../../utils/categorias.js';

export default function BienvenidaPage() {
  const { usuario } = useAutenticacion();
  const { datos, cargando, error, recargar } = useDatos(() => Promise.all([listarCatalogo(), obtenerFiltrosCatalogo()]));

  if (cargando) return <Cargando texto="Cargando la tienda..." />;
  if (error) return <div className="pagina tarjeta"><ErrorCarga error={error} alReintentar={recargar} /></div>;

  const [productos, filtros] = datos;
  const disponibles = productos.filter((p) => p.disponibilidad !== 'agotado');
  const novedades = [...productos].sort((a, b) => b.id_producto - a.id_producto).slice(0, 8);
  // En la portada solo van las categorías principales; cada una cuenta también sus subcategorías
  // y usa como imagen la foto de uno de sus productos (si alguno tiene).
  const principales = filtros.categorias.filter((c) => !c.id_categoria_padre);
  const fotoDe = (idCategoria) => {
    const ids = idsIncluidos([idCategoria], filtros.categorias);
    return productos.find((p) => ids.has(p.id_categoria) && p.foto_principal)?.foto_principal ?? null;
  };
  const anuncios = [
    {
      titulo: 'Bienvenida a Desy',
      texto: filtros.mensaje_catalogo || 'Bisutería y accesorios hechos con cariño.',
      ruta: '/catalogo',
      textoBoton: 'Ver catálogo',
      estilo: 'cafe'
    },
    {
      titulo: `${disponibles.length} productos disponibles`,
      texto: `Bisutería, crochet, llaveros y más, en ${principales.length} categorías.`,
      ruta: '/catalogo',
      textoBoton: 'Explorar',
      estilo: 'verde'
    },
    usuario
      ? { titulo: `Hola, ${usuario.nombre?.split(' ')[0] ?? ''}`, texto: `Entró como ${NOMBRES_ROLES[usuario.rol]}.`, ruta: INICIO_POR_ROL[usuario.rol], textoBoton: 'Ir a mi panel', estilo: 'miel' }
      : { titulo: 'Cree su cuenta de cliente', texto: 'Vea su historial de compras y proteja su cuenta con verificación en dos pasos.', ruta: '/registro', textoBoton: 'Crear cuenta', estilo: 'miel' }
  ];

  return (
    <PaginaAnimada>
      <CarruselAnuncios anuncios={anuncios} />

      <FilaDeslizable titulo="Nuestras categorías">
        {principales.map((categoria) => {
          const foto = fotoDe(categoria.id_categoria);
          return (
            <Link key={categoria.id_categoria} to={`/catalogo?categoria=${categoria.id_categoria}`} className="tarjeta-categoria">
              <span className={`categoria-icono ${foto ? 'con-foto' : fondoDeCategoria(categoria.id_categoria)}`} aria-hidden="true">
                <FotoProducto archivo={foto} alt="" nombreCategoria={categoria.nombre} tamanoIcono={28} />
              </span>
              <span className="categoria-nombre">{categoria.nombre}</span>
              <span className="categoria-cantidad">{contarProductos(productos, categoria.id_categoria, filtros.categorias)} producto(s)</span>
            </Link>
          );
        })}
      </FilaDeslizable>

      <FilaDeslizable
        titulo="Novedades"
        accion={
          <Link to="/catalogo" className="enlace-ver-mas">
            Ver todo <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      >
        {novedades.map((producto, indice) => (
          <TarjetaProducto key={producto.id_producto} producto={producto} indice={indice} compacta publico rutaBase="/catalogo" />
        ))}
      </FilaDeslizable>

      {!usuario && (
        <section className="tarjeta bienvenida-cuenta" aria-labelledby="titulo-cuenta">
          <Store size={32} aria-hidden="true" />
          <div>
            <h2 id="titulo-cuenta">¿Ya compró en Desy?</h2>
            <p className="texto-secundario">Cree una cuenta con el mismo correo que dio en la tienda para ver su historial de compras. Siempre pedimos un código además de la contraseña.</p>
          </div>
          <div className="bienvenida-botones">
            <Link to="/registro" className="boton boton-primario">
              <UserPlus size={18} aria-hidden="true" /> <span>Crear cuenta</span>
            </Link>
            <Link to="/login" className="boton boton-secundario">
              <LogIn size={18} aria-hidden="true" /> <span>Iniciar sesión</span>
            </Link>
          </div>
        </section>
      )}
    </PaginaAnimada>
  );
}
