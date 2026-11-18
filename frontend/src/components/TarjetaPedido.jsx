// Tarjeta de un pedido: número, estado, plazo, productos, total y nota.
// La usan "Mis pedidos" (cliente) y la bandeja de pedidos de la tienda.
// "paraTienda" muestra los datos de contacto del cliente; "acciones" son los botones.
import { Link } from 'react-router';
import { CalendarClock, Mail, MessageSquareText, Phone } from 'lucide-react';
import FotoProducto from './FotoProducto.jsx';
import { InsigniaPedido } from './Insignias.jsx';
import { formatearFechaHora, formatearPrecio } from '../utils/formato.js';

function textoPlazo(pedido, paraTienda) {
  if (!pedido.activo) return null;
  const fecha = formatearFechaHora(pedido.vence_en);
  if (pedido.estado === 'pendiente') return paraTienda ? `Confirmar antes del ${fecha}` : `La tienda le confirmará antes del ${fecha}`;
  return paraTienda ? `El cliente puede recogerlo hasta el ${fecha}` : `Recójalo y páguelo en la tienda antes del ${fecha}`;
}

export default function TarjetaPedido({ pedido, paraTienda = false, acciones = null, destacado = false }) {
  const plazo = textoPlazo(pedido, paraTienda);
  return (
    <article className={`tarjeta tarjeta-pedido pedido-${pedido.estado}${destacado ? ' destacado' : ''}`} aria-labelledby={`pedido-${pedido.id_pedido}`}>
      <header className="tarjeta-pedido-encabezado">
        <div>
          <h3 id={`pedido-${pedido.id_pedido}`}>Pedido #{pedido.id_pedido}</h3>
          <small className="texto-secundario">Hecho el {formatearFechaHora(pedido.creado_en)}</small>
        </div>
        <InsigniaPedido estado={pedido.estado} />
      </header>

      {paraTienda && (
        <p className="pedido-cliente">
          <strong>{pedido.nombre_cliente}</strong>
          <a href={`mailto:${pedido.correo_cliente}`}>
            <Mail size={14} aria-hidden="true" /> {pedido.correo_cliente}
          </a>
          {pedido.telefono_cliente && (
            <a href={`tel:${pedido.telefono_cliente}`}>
              <Phone size={14} aria-hidden="true" /> {pedido.telefono_cliente}
            </a>
          )}
        </p>
      )}

      {plazo && (
        <p className="pedido-plazo">
          <CalendarClock size={16} aria-hidden="true" /> {plazo}
        </p>
      )}

      <ul className="pedido-productos">
        {pedido.detalle.map((d) => (
          <li key={d.id_detalle_pedido}>
            <span className="pedido-foto" aria-hidden="true">
              <FotoProducto archivo={d.foto_principal} alt="" tamanoIcono={20} />
            </span>
            <span className="pedido-producto-nombre">
              {d.cantidad} × {d.nombre_producto}
              <small>{d.codigo}</small>
            </span>
            <span>{formatearPrecio(d.subtotal)}</span>
          </li>
        ))}
      </ul>
      <p className="pedido-total">
        <span>{pedido.estado === 'entregado' ? 'Total pagado' : pedido.activo ? 'Total a pagar en la tienda' : 'Total'}</span>
        <strong>{formatearPrecio(pedido.total)}</strong>
      </p>

      {pedido.nota_cliente && (
        <p className="pedido-nota">
          <MessageSquareText size={16} aria-hidden="true" /> <span>{paraTienda ? 'Nota del cliente: ' : 'Su nota: '}{pedido.nota_cliente}</span>
        </p>
      )}
      {pedido.motivo && ['rechazado', 'cancelado', 'vencido'].includes(pedido.estado) && <p className="pedido-motivo">Motivo: {pedido.motivo}</p>}
      {pedido.estado === 'entregado' && pedido.id_venta && (
        <p className="texto-secundario">
          Venta #{pedido.id_venta}
          {pedido.nombre_atendio ? ` · le atendió ${pedido.nombre_atendio}` : ''}
          {!paraTienda && (
            <>
              {' · '}
              <Link to="/cliente">ver en Mis compras</Link>
            </>
          )}
        </p>
      )}
      {acciones && <div className="tarjeta-pedido-acciones">{acciones}</div>}
    </article>
  );
}
