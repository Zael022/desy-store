// Botón "Agregar al pedido" del catálogo (solo visitantes y clientes; el personal vende en el punto de venta).
//   - compacto: solo el botón (tarjetas del catálogo).
//   - normal: con selector de cantidad (ficha del producto).
// Agregar NO aparta nada todavía: las unidades se apartan al ENVIAR el pedido en "Mi pedido".
import { useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import Boton from './Boton.jsx';
import { usePedido } from '../hooks/usePedido.js';
import { useAutenticacion } from '../hooks/useAutenticacion.js';
import { MAXIMO_PRODUCTOS, MAXIMO_UNIDADES } from '../context/contextoPedido.js';

export default function AgregarAlPedido({ producto, compacto = false }) {
  const { usuario } = useAutenticacion();
  const { lineas, agregar } = usePedido();
  const [cantidad, setCantidad] = useState(1);

  if (usuario && usuario.rol !== 'cliente') return null; // el personal y los proveedores no hacen pedidos
  if (producto.disponibilidad === 'agotado') return null;

  const enPedido = lineas.find((l) => l.id_producto === producto.id_producto)?.cantidad ?? 0;
  const lleno = enPedido >= MAXIMO_UNIDADES;

  function alAgregar() {
    const aSumar = compacto ? 1 : cantidad;
    if (!agregar(producto, aSumar)) {
      toast.error(`Un pedido puede tener como máximo ${MAXIMO_PRODUCTOS} productos distintos.`);
      return;
    }
    const total = Math.min(enPedido + aSumar, MAXIMO_UNIDADES);
    toast.success(`${producto.nombre}: ${total} en su pedido.`, { id: `pedido-${producto.id_producto}` });
    setCantidad(1);
  }

  if (compacto) {
    return (
      <Boton variante="secundario" icono={ShoppingBag} onClick={alAgregar} disabled={lleno} className="boton-agregar-pedido" aria-label={`Agregar ${producto.nombre} al pedido`}>
        {enPedido > 0 ? `En su pedido (${enPedido})` : 'Agregar al pedido'}
      </Boton>
    );
  }

  return (
    <div className="agregar-pedido">
      <div className="contador-pedido" role="group" aria-label="Cantidad">
        <button type="button" onClick={() => setCantidad(Math.max(cantidad - 1, 1))} disabled={cantidad <= 1} aria-label="Restar uno">
          <Minus size={16} aria-hidden="true" />
        </button>
        <span aria-live="polite">{cantidad}</span>
        <button type="button" onClick={() => setCantidad(Math.min(cantidad + 1, MAXIMO_UNIDADES - enPedido))} disabled={enPedido + cantidad >= MAXIMO_UNIDADES} aria-label="Sumar uno">
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <Boton icono={ShoppingBag} onClick={alAgregar} disabled={lleno}>
        Agregar al pedido
      </Boton>
      {enPedido > 0 && (
        <p className="ficha-nota">
          Ya tiene {enPedido} en <Link to="/pedido">su pedido</Link>.
        </p>
      )}
    </div>
  );
}
