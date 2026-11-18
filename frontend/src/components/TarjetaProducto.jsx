// Tarjeta de un producto: imagen, nombre, precio y stock (o disponibilidad).
// - Al hacer clic en la imagen o el nombre se abre la ficha del producto.
// - Si se pasan alEditar y alEliminar, aparecen los botones redondos de editar y eliminar
//   (y el de fotos, si se pasa alFotos).
// - publico = true (catálogo): muestra "Disponible / Pocas unidades / Agotado" y
//   NUNCA el stock exacto ni el proveedor.
// La imagen es la foto principal del producto; si no tiene, un ícono según la categoría.
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Images, Pencil, Trash2 } from 'lucide-react';
import Boton from './Boton.jsx';
import IndicadorStock from './IndicadorStock.jsx';
import { InsigniaDisponibilidad } from './Insignias.jsx';
import { formatearPrecio } from '../utils/formato.js';
import FotoProducto from './FotoProducto.jsx';
import AgregarAlPedido from './AgregarAlPedido.jsx';
import { fondoDeCategoria } from '../utils/fondosCategoria.js';

export default function TarjetaProducto({
  producto,
  stockMaximo,
  indice = 0,
  ocupado = false,
  alEditar,
  alEliminar,
  alFotos,
  compacta = false,
  publico = false,
  rutaBase = '/admin/productos'
}) {
  const ruta = `${publico && rutaBase === '/admin/productos' ? '/catalogo' : rutaBase}/${producto.id_producto}`;
  const conAcciones = Boolean(alEditar && alEliminar);
  const agotado = publico ? producto.disponibilidad === 'agotado' : producto.stock === 0;

  return (
    <motion.article
      layout="position"
      className={compacta ? 'tarjeta-producto compacta' : 'tarjeta-producto'}
      aria-label={producto.nombre}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(indice * 0.05, 0.5) } }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      whileHover={{ y: -4 }}
    >
      <div className={`producto-imagen ${producto.foto_principal ? 'con-foto' : fondoDeCategoria(producto.id_categoria)}`}>
        <Link to={ruta} className="producto-enlace-imagen" tabIndex={-1} aria-hidden="true">
          <FotoProducto
            archivo={producto.foto_principal}
            alt=""
            nombreCategoria={producto.nombre_categoria}
            nombreCategoriaPadre={producto.nombre_categoria_padre}
            tamanoIcono={compacta ? 54 : 72}
            prioridad={indice < 4}
          />
        </Link>
        {agotado && <span className="producto-sello sello-agotado">Agotado</span>}
        {conAcciones && (
          <div className="producto-acciones">
            {alFotos && (
              <Boton variante="circulo" icono={Images} onClick={() => alFotos(producto)} disabled={ocupado} aria-label={`Fotos de ${producto.nombre}`} title="Fotos" />
            )}
            <Boton variante="circulo" icono={Pencil} onClick={() => alEditar(producto)} disabled={ocupado} aria-label={`Editar ${producto.nombre}`} title="Editar" />
            <Boton
              variante="circulo"
              className="boton-eliminar"
              icono={Trash2}
              onClick={() => alEliminar(producto)}
              disabled={ocupado}
              aria-label={`Eliminar ${producto.nombre}`}
              title="Eliminar"
            />
          </div>
        )}
      </div>
      <p className="producto-codigo">
        {producto.codigo} · {producto.nombre_categoria}
      </p>
      <h3 className="producto-nombre">
        <Link to={ruta}>{producto.nombre}</Link>
      </h3>
      {!compacta && (
        <p className="producto-detalle">
          {producto.nombre_material}
          {!publico && producto.nombre_proveedor ? ` · ${producto.nombre_proveedor}` : ''}
        </p>
      )}
      <p className="producto-precio">{formatearPrecio(producto.precio)}</p>
      {publico ? <InsigniaDisponibilidad valor={producto.disponibilidad} /> : <IndicadorStock stock={producto.stock} maximo={stockMaximo} />}
      {publico && !compacta && <AgregarAlPedido producto={producto} compacto />}
    </motion.article>
  );
}
