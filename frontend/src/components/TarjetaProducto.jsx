// Tarjeta de un producto: imagen, nombre, precio y stock.
// - Al hacer clic en la imagen o el nombre se abre la ficha del producto.
// - Si se pasan alEditar y alEliminar, aparecen los botones redondos de editar y eliminar.
// Como el sistema no guarda fotos, la "imagen" es un ícono según la categoría (components/IconoCategoria.jsx).
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Pencil, Trash2 } from 'lucide-react';
import Boton from './Boton.jsx';
import IndicadorStock from './IndicadorStock.jsx';
import { formatearPrecio } from '../utils/formato.js';
import IconoCategoria from './IconoCategoria.jsx';
import { fondoDeCategoria } from '../utils/fondosCategoria.js';

export default function TarjetaProducto({ producto, stockMaximo, indice = 0, ocupado = false, alEditar, alEliminar, compacta = false }) {
  const ruta = `/productos/${producto.id_producto}`;
  const conAcciones = Boolean(alEditar && alEliminar);

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
      <div className={`producto-imagen ${fondoDeCategoria(producto.id_categoria)}`}>
        <Link to={ruta} className="producto-enlace-imagen" tabIndex={-1} aria-hidden="true">
          <IconoCategoria nombre={producto.nombre_categoria} size={compacta ? 54 : 72} strokeWidth={1.3} />
        </Link>
        {producto.stock === 0 && <span className="producto-sello sello-agotado">Agotado</span>}
        {conAcciones && (
          <div className="producto-acciones">
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
          {producto.nombre_material} · {producto.nombre_proveedor}
        </p>
      )}
      <p className="producto-precio">{formatearPrecio(producto.precio)}</p>
      <IndicadorStock stock={producto.stock} maximo={stockMaximo} />
    </motion.article>
  );
}
