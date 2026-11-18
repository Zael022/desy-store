// Pantalla 10: Dashboard ejecutivo (solo la dueña).
// Ventas, ingresos, productos más vendidos, menor stock, rendimiento por
// empleado, costos, ganancias y valor del inventario, con filtro de fechas.
// Todo sale del backend (/api/reportes/ejecutivo): no hay datos escritos a mano.
// Las ganancias se calculan SOLO con productos que tienen costo real; si
// faltan costos, se avisa y se dice cuáles.
import { useState } from 'react';
import { Link } from 'react-router';
import { Boxes, ChartLine, Coins, PackageSearch, Receipt, RotateCcw, TriangleAlert, Wallet } from 'lucide-react';
import PaginaAnimada from '../../components/PaginaAnimada.jsx';
import EncabezadoPagina from '../../components/EncabezadoPagina.jsx';
import TarjetaResumen from '../../components/TarjetaResumen.jsx';
import CampoFormulario from '../../components/CampoFormulario.jsx';
import Boton from '../../components/Boton.jsx';
import { GraficoBarras, GraficoIngresos } from '../../components/GraficosDashboard.jsx';
import { Cargando, ErrorCarga, SinRegistros } from '../../components/EstadoLista.jsx';
import { obtenerReporteEjecutivo } from '../../services/reportesService.js';
import { useDatos } from '../../hooks/useDatos.js';
import { fechaDeHoy, fechaHaceDias, formatearFecha, formatearPrecio } from '../../utils/formato.js';

const ATAJOS = [
  { dias: 7, texto: '7 días' },
  { dias: 30, texto: '30 días' },
  { dias: 90, texto: '90 días' }
];

export default function DashboardDuenaPage() {
  const [rango, setRango] = useState({ desde: fechaHaceDias(29), hasta: fechaDeHoy() });
  const { datos: r, cargando, error, recargar } = useDatos(() => obtenerReporteEjecutivo(rango), [rango.desde, rango.hasta]);
  const cambiar = (campo, valor) => setRango({ ...rango, [campo]: valor });

  return (
    <PaginaAnimada>
      <EncabezadoPagina ruta={['Dueña', 'Dashboard ejecutivo']} descripcion="Cómo va el negocio: ingresos, ganancias, productos y personas." />
      <div className="filtros-fecha" role="group" aria-label="Periodo del reporte">
        <CampoFormulario id="desde" etiqueta="Desde" tipo="date" valor={rango.desde} alCambiar={cambiar} max={rango.hasta} />
        <CampoFormulario id="hasta" etiqueta="Hasta" tipo="date" valor={rango.hasta} alCambiar={cambiar} min={rango.desde} />
        <div className="atajos-fecha">
          {ATAJOS.map(({ dias, texto }) => (
            <Boton key={dias} variante="secundario" onClick={() => setRango({ desde: fechaHaceDias(dias - 1), hasta: fechaDeHoy() })}>
              Últimos {texto}
            </Boton>
          ))}
        </div>
      </div>

      {cargando && !r ? (
        <div className="tarjeta"><Cargando texto="Calculando el reporte..." /></div>
      ) : error ? (
        <div className="tarjeta"><ErrorCarga error={error} alReintentar={recargar} /></div>
      ) : (
        <div className={cargando ? 'pila actualizando' : 'pila'} aria-busy={cargando}>
          <p className="texto-secundario">
            Periodo: {formatearFecha(r.desde)} al {formatearFecha(r.hasta)}
          </p>
          <div className="grilla-resumen">
            <TarjetaResumen indice={0} icono={Wallet} titulo="Ingresos netos" valor={formatearPrecio(r.resumen.ingresos_netos)} detalle={`brutos ${formatearPrecio(r.resumen.ingresos_brutos)}`} />
            <TarjetaResumen indice={1} icono={Receipt} titulo="Ventas" valor={r.resumen.ventas} detalle={`${r.resumen.unidades_vendidas} unidades`} />
            <TarjetaResumen indice={2} icono={Coins} titulo="Ganancia" valor={formatearPrecio(r.resumen.ganancia)} detalle={r.ganancia_parcial ? 'parcial: faltan costos' : 'con costos reales'} aviso={r.ganancia_parcial} />
            <TarjetaResumen indice={3} icono={ChartLine} titulo="Costo de lo vendido" valor={formatearPrecio(r.resumen.costo_de_lo_vendido)} detalle="solo productos con costo" />
            <TarjetaResumen indice={4} icono={RotateCcw} titulo="Devoluciones" valor={formatearPrecio(r.resumen.devoluciones)} detalle="restadas de los ingresos" />
            <TarjetaResumen indice={5} icono={Boxes} titulo="Valor del inventario" valor={formatearPrecio(r.inventario.valor_a_precio_de_venta)} detalle={`a costo: ${formatearPrecio(r.inventario.valor_a_costo)} · ${r.inventario.unidades} u.`} />
          </div>

          {(r.ganancia_parcial || r.inventario.productos_sin_costo.length > 0) && (
            <div className="alerta alerta-advertencia" role="status">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>
                {r.resumen.lineas_sin_costo > 0 && `${r.resumen.lineas_sin_costo} línea(s) vendida(s) (${formatearPrecio(r.resumen.ingresos_sin_costo)}) no tienen costo y no cuentan en la ganancia. `}
                Productos sin costo: {r.inventario.productos_sin_costo.map((p) => p.codigo).join(', ') || 'ninguno'}. Registre el costo en <Link to="/admin/productos">Productos</Link>.
              </span>
            </div>
          )}

          <section className="tarjeta" aria-labelledby="titulo-ingresos">
            <h2 id="titulo-ingresos">Ingresos y ganancia por día</h2>
            {r.por_dia.length === 0 ? <SinRegistros texto="No hubo ventas en este periodo." /> : <GraficoIngresos datos={r.por_dia} gananciaParcial={r.ganancia_parcial} />}
          </section>

          <div className="grilla-dos">
            <section className="tarjeta" aria-labelledby="titulo-top">
              <h2 id="titulo-top">Productos más vendidos</h2>
              {r.mas_vendidos.length === 0 ? (
                <SinRegistros texto="Sin ventas en el periodo." />
              ) : (
                <GraficoBarras
                  datos={r.mas_vendidos}
                  clave="unidades"
                  nombre="Unidades vendidas (netas)"
                  etiqueta="nombre"
                  columnas={[
                    { clave: 'nombre', titulo: 'Producto' },
                    { clave: 'unidades', titulo: 'Unidades' },
                    { clave: 'ingresos', titulo: 'Ingresos', formato: formatearPrecio }
                  ]}
                />
              )}
            </section>
            <section className="tarjeta" aria-labelledby="titulo-empleados">
              <h2 id="titulo-empleados">Rendimiento por empleado</h2>
              {r.por_empleado.length === 0 ? (
                <SinRegistros texto="Sin ventas en el periodo." />
              ) : (
                <GraficoBarras
                  datos={r.por_empleado}
                  clave="ingresos"
                  nombre="Ingresos netos"
                  etiqueta="nombre"
                  formatoValor={formatearPrecio}
                  columnas={[
                    { clave: 'nombre', titulo: 'Empleado' },
                    { clave: 'ventas', titulo: 'Ventas' },
                    { clave: 'unidades', titulo: 'Unidades' },
                    { clave: 'ingresos', titulo: 'Ingresos', formato: formatearPrecio }
                  ]}
                />
              )}
            </section>
          </div>

          <section className="tarjeta" aria-labelledby="titulo-menor">
            <h2 id="titulo-menor"><PackageSearch size={20} aria-hidden="true" /> Productos con menor stock</h2>
            <ol className="lista-ranking">
              {r.menor_stock.map((p) => (
                <li key={p.id_producto}>
                  <Link to={`/admin/productos/${p.id_producto}`}>{p.codigo} · {p.nombre}</Link>
                  <strong className={p.stock === 0 ? 'texto-salida' : ''}>{p.stock === 0 ? 'Agotado' : `${p.stock} u.`}</strong>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </PaginaAnimada>
  );
}
