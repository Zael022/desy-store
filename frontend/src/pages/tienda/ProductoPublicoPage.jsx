// Ficha pública de un producto (/catalogo/:id): fotos, precio, material, descripción y
// disponibilidad. No hay carrito ni pago: la compra se hace en la tienda.
import { Link, useParams } from 'react-router';
import { Layers, PackageX, ShieldCheck, Store } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import MigasDePan from '../../components/MigasDePan.jsx';
import FilaDeslizable from '../../components/FilaDeslizable.jsx';
import TarjetaProducto from '../../components/TarjetaProducto.jsx';
import GaleriaProducto from '../../components/GaleriaProducto.jsx';
import AgregarAlPedido from '../../components/AgregarAlPedido.jsx';
import { InsigniaDisponibilidad } from '../../components/Insignias.jsx';
import { Cargando, ErrorCarga } from '../../components/EstadoLista.jsx';
import { listarCatalogo, obtenerProductoCatalogo } from '../../services/catalogoService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { formatearPrecio } from '../../utils/formato.js';

const TEXTO_DISPONIBILIDAD = {
  disponible: 'Hay unidades disponibles: puede pedirlo y se lo apartamos.',
  pocas: '¡Quedan pocas unidades! Haga su pedido para apartarlas.',
  agotado: 'Por ahora está agotado. Vuelva a consultar pronto.'
};

export default function ProductoPublicoPage() {
  const { id } = useParams();
  const { datos, cargando, error, recargar } = useDatos(() => Promise.all([obtenerProductoCatalogo(id), listarCatalogo()]), [id]);

  if (cargando) return <Cargando texto="Cargando el producto..." />;
  if (error) {
    return (
      <PaginaAnimada>
        <MigasDePan pasos={[{ texto: 'Inicio', ruta: '/' }, { texto: 'Catálogo', ruta: '/catalogo' }, { texto: 'No encontrado' }]} />
        <div className="tarjeta">
          {error.status === 404 || error.status === 400 ? (
            <div className="estado">
              <PackageX size={34} aria-hidden="true" />
              <p><strong>Este producto no existe o ya no está en el catálogo.</strong></p>
              <Link to="/catalogo">Volver al catálogo</Link>
            </div>
          ) : (
            <ErrorCarga error={error} alReintentar={recargar} />
          )}
        </div>
      </PaginaAnimada>
    );
  }

  const [producto, todos] = datos;
  // Similares: primero la misma categoría y después las de la misma familia (por ejemplo, todo Crochet).
  const familia = producto.id_categoria_padre ?? producto.id_categoria;
  const otros = todos.filter((p) => p.id_producto !== producto.id_producto);
  const similares = [
    ...otros.filter((p) => p.id_categoria === producto.id_categoria),
    ...otros.filter((p) => p.id_categoria !== producto.id_categoria && (p.id_categoria_padre ?? p.id_categoria) === familia)
  ].slice(0, 8);

  return (
    <PaginaAnimada>
      <MigasDePan
        pasos={[
          { texto: 'Inicio', ruta: '/' },
          { texto: 'Catálogo', ruta: '/catalogo' },
          ...(producto.id_categoria_padre ? [{ texto: producto.nombre_categoria_padre, ruta: `/catalogo?categoria=${producto.id_categoria_padre}` }] : []),
          { texto: producto.nombre_categoria, ruta: `/catalogo?categoria=${producto.id_categoria}` },
          { texto: producto.nombre }
        ]}
      />
      <div className="ficha">
        <GaleriaProducto key={producto.id_producto} producto={producto} fotos={producto.fotos ?? []} medidas={producto.fotos_medidas ?? []} agotado={producto.disponibilidad === 'agotado'} />
        <div className="ficha-info">
          <p className="ficha-codigo">Código: {producto.codigo}</p>
          <h1 className="ficha-nombre">{producto.nombre}</h1>
          <p className="ficha-precio">{formatearPrecio(producto.precio)}</p>
          <div className="ficha-caja">
            <p>
              <Layers size={18} aria-hidden="true" /> {producto.nombre_material}
              {producto.es_hipoalergenico && (
                <span className="etiqueta etiqueta-si">
                  <ShieldCheck size={14} aria-hidden="true" /> Hipoalergénico
                </span>
              )}
            </p>
            <p>{producto.descripcion || 'Sin descripción.'}</p>
          </div>
          <div className="ficha-movimiento">
            <InsigniaDisponibilidad valor={producto.disponibilidad} />
            <p className="ficha-disponible">{TEXTO_DISPONIBILIDAD[producto.disponibilidad]}</p>
            <AgregarAlPedido producto={producto} />
            <p className="ficha-nota">
              <Store size={16} aria-hidden="true" /> Haga su pedido aquí: las unidades quedan apartadas, la tienda lo confirma y usted lo recoge y paga en la tienda Desy.
            </p>
          </div>
        </div>
      </div>
      {similares.length > 0 && (
        <FilaDeslizable titulo="También le puede gustar">
          {similares.map((p, indice) => (
            <TarjetaProducto key={p.id_producto} producto={p} indice={indice} compacta publico rutaBase="/catalogo" />
          ))}
        </FilaDeslizable>
      )}
    </PaginaAnimada>
  );
}
