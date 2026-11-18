// Tabla con las líneas de una venta: producto, cantidad, lo devuelto, precio y subtotal.
// mostrarCosto: solo para la dueña (el backend solo envía el costo en su sesión).
import { formatearPrecio } from '../utils/formato.js';

export default function DetalleVenta({ venta, mostrarCosto = false }) {
  return (
    <div className="tabla-contenedor">
      <table className="tabla tabla-compacta">
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col">Cantidad</th>
            <th scope="col">Devuelto</th>
            <th scope="col">Precio</th>
            {mostrarCosto && <th scope="col">Costo</th>}
            <th scope="col">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {venta.detalle.map((linea) => (
            <tr key={linea.id_detalle_venta}>
              <td data-titulo="Producto">
                {linea.codigo} · {linea.nombre_producto}
              </td>
              <td data-titulo="Cantidad">{linea.cantidad}</td>
              <td data-titulo="Devuelto">{linea.cantidad_devuelta > 0 ? linea.cantidad_devuelta : '—'}</td>
              <td data-titulo="Precio">{formatearPrecio(linea.precio_unitario)}</td>
              {mostrarCosto && <td data-titulo="Costo">{linea.costo_unitario === null ? 'sin costo' : formatearPrecio(linea.costo_unitario)}</td>}
              <td data-titulo="Subtotal">{formatearPrecio(linea.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={mostrarCosto ? 5 : 4}>
              Total
            </th>
            <td>
              <strong>{formatearPrecio(venta.total)}</strong>
            </td>
          </tr>
          {venta.total_devuelto > 0 && (
            <tr>
              <th scope="row" colSpan={mostrarCosto ? 5 : 4}>
                Devuelto
              </th>
              <td className="texto-salida">−{formatearPrecio(venta.total_devuelto)}</td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
