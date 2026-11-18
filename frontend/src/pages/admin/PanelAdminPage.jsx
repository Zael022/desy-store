// Pantalla 9: Panel administrativo (administración y dueña).
// Resumen operativo SIN costos ni ganancias: ventas y unidades, devoluciones,
// stock bajo, solicitudes pendientes y rendimiento por vendedor.
// Debajo va el resumen del inventario (la antigua página de inicio).
import { useState } from 'react';
import { Link } from 'react-router';
import { ClipboardList, PackageX, Receipt, RotateCcw, TriangleAlert } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import TarjetaResumen from '../../components/TarjetaResumen.jsx';
import TablaDatos from '../../components/TablaDatos.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import ResumenInventario from '../ResumenInventario.jsx';
import { obtenerReporteOperativo } from '../../services/reportesService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { fechaDeHoy, fechaHaceDias } from '../../utils/formato.js';

export default function PanelAdminPage() {
  const [rango, setRango] = useState({ desde: fechaHaceDias(29), hasta: fechaDeHoy() });
  const { datos: r, cargando, error, recargar } = useDatos(() => obtenerReporteOperativo(rango), [rango.desde, rango.hasta]);

  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Administración', 'Panel']} descripcion="Lo que necesita atender hoy: stock bajo, pedidos a proveedores y la actividad de ventas." />
      <div className="filtros-fecha">
        <CampoFormulario id="desde" etiqueta="Desde" tipo="date" valor={rango.desde} alCambiar={(c, v) => setRango({ ...rango, [c]: v })} />
        <CampoFormulario id="hasta" etiqueta="Hasta" tipo="date" valor={rango.hasta} alCambiar={(c, v) => setRango({ ...rango, [c]: v })} />
      </div>
      {cargando && !r ? (
        <div className="tarjeta"><Cargando /></div>
      ) : error ? (
        <div className="tarjeta"><ErrorCarga error={error} alReintentar={recargar} /></div>
      ) : (
        <>
          <div className="grilla-resumen">
            <TarjetaResumen indice={0} icono={Receipt} titulo="Ventas" valor={r.ventas.cantidad} detalle={`${r.ventas.unidades} unidades vendidas`} />
            <TarjetaResumen indice={1} icono={RotateCcw} titulo="Devoluciones" valor={r.devoluciones.cantidad} detalle={`${r.devoluciones.unidades} unidades devueltas`} />
            <TarjetaResumen indice={2} icono={TriangleAlert} titulo="Stock bajo" valor={r.stock_bajo.length} detalle={`con ${r.umbral_pocas_unidades} unidades o menos`} aviso={r.stock_bajo.length > 0} />
            <TarjetaResumen indice={3} icono={ClipboardList} titulo="Solicitudes" valor={r.solicitudes.pendientes} detalle={`pendientes · ${r.solicitudes.aceptadas} por recibir`} />
          </div>

          <div className="grilla-dos">
            <section className="tarjeta" aria-labelledby="titulo-stock-bajo">
              <h2 id="titulo-stock-bajo"><PackageX size={20} aria-hidden="true" /> Alertas de stock bajo</h2>
              {r.stock_bajo.length === 0 ? (
                <SinRegistros texto="Ningún producto está por debajo del umbral." />
              ) : (
                <TablaDatos
                  columnas={[
                    { clave: 'nombre', titulo: 'Producto', mostrar: (p) => <Link to={`/admin/productos/${p.id_producto}`}>{p.codigo} · {p.nombre}</Link> },
                    { clave: 'stock', titulo: 'Stock', mostrar: (p) => <strong className={p.stock === 0 ? 'texto-salida' : ''}>{p.stock}</strong> },
                    { clave: 'nombre_proveedor', titulo: 'Proveedor' }
                  ]}
                  filas={r.stock_bajo}
                  llave="id_producto"
                  acciones={(p) => <Link className="enlace-accion" to={`/admin/abastecimiento?proveedor=${p.id_proveedor}`}>Pedir</Link>}
                />
              )}
            </section>
            <section className="tarjeta" aria-labelledby="titulo-actividad">
              <h2 id="titulo-actividad">Más vendidos y vendedores</h2>
              {r.mas_vendidos.length === 0 ? (
                <SinRegistros texto="No hubo ventas en este periodo." />
              ) : (
                <>
                  <ol className="lista-ranking">
                    {r.mas_vendidos.map((p) => (
                      <li key={p.id_producto}><span>{p.nombre}</span><strong>{p.unidades} u.</strong></li>
                    ))}
                  </ol>
                  <h3>Ventas por vendedor</h3>
                  <ul className="lista-ranking">
                    {r.por_vendedor.map((v) => (
                      <li key={v.id_empleado}><span>{v.nombre}</span><strong>{v.ventas} venta(s) · {v.unidades} u.</strong></li>
                    ))}
                  </ul>
                </>
              )}
              <p className="texto-secundario texto-pequeno"><Link to="/admin/ventas">Ver todas las ventas y devoluciones</Link></p>
            </section>
          </div>
        </>
      )}
      <ResumenInventario />
    </PaginaAnimada>
  );
}
