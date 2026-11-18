// Gráficos del dashboard ejecutivo (Recharts).
// Reglas que seguimos: un solo eje Y por gráfico, colores revisados para
// daltonismo (verde #3e7a2e y miel #c0862a, validados con contraste suficiente),
// leyenda cuando hay dos series, tooltip al pasar el mouse y tabla con los mismos datos.
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'motion/react';
import { formatearFecha, formatearPrecio } from '../utils/formato.js';

const COLOR_INGRESOS = '#3e7a2e';
const COLOR_GANANCIA = '#c0862a';
const EJE = { tickLine: false, tick: { fill: 'var(--texto-secundario)', fontSize: 12 } };
const compacto = new Intl.NumberFormat('es-CR', { notation: 'compact', maximumFractionDigits: 1 });

function CuadroDetalle({ active, payload, label, formatoEtiqueta = (v) => v, formatoValor = formatearPrecio }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="grafico-tooltip">
      <strong>{formatoEtiqueta(label)}</strong>
      {payload.map((serie) => (
        <span key={serie.dataKey}>
          <i className="punto-leyenda" style={{ background: serie.color }} aria-hidden="true" /> {serie.name}: {formatoValor(serie.value)}
        </span>
      ))}
    </div>
  );
}

function TablaDelGrafico({ columnas, filas }) {
  return (
    <details className="grafico-tabla">
      <summary>Ver los datos en una tabla</summary>
      <table className="tabla tabla-compacta">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} scope="col">{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {columnas.map((c) => (
                <td key={c.clave}>{c.formato ? c.formato(fila[c.clave]) : fila[c.clave]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// Ingresos netos y ganancia por día (misma unidad: colones -> un solo eje).
export function GraficoIngresos({ datos, gananciaParcial }) {
  const reducir = useReducedMotion();
  return (
    <figure className="grafico" aria-label="Gráfico de líneas de ingresos netos y ganancia por día">
      <div className="grafico-area">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--linea-suave)" />
            <XAxis dataKey="dia" {...EJE} axisLine={{ stroke: 'var(--borde)' }} tickFormatter={(d) => formatearFecha(d).slice(0, 5)} />
            <YAxis {...EJE} axisLine={false} width={56} tickFormatter={(v) => `₡${compacto.format(v)}`} />
            <Tooltip content={<CuadroDetalle formatoEtiqueta={formatearFecha} />} cursor={{ stroke: 'var(--texto-secundario)', strokeDasharray: '4 4' }} />
            <Legend verticalAlign="top" height={28} iconType="plainline" />
            <Line type="monotone" dataKey="ingresos" name="Ingresos netos" stroke={COLOR_INGRESOS} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--superficie)' }} activeDot={{ r: 6 }} isAnimationActive={!reducir} />
            <Line type="monotone" dataKey="ganancia" name={gananciaParcial ? 'Ganancia (solo con costo)' : 'Ganancia'} stroke={COLOR_GANANCIA} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, strokeWidth: 2, fill: 'var(--superficie)' }} activeDot={{ r: 6 }} isAnimationActive={!reducir} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TablaDelGrafico
        columnas={[
          { clave: 'dia', titulo: 'Día', formato: formatearFecha },
          { clave: 'ventas', titulo: 'Ventas' },
          { clave: 'ingresos', titulo: 'Ingresos netos', formato: formatearPrecio },
          { clave: 'ganancia', titulo: 'Ganancia', formato: formatearPrecio }
        ]}
        filas={datos}
      />
    </figure>
  );
}

// Barras horizontales de una sola serie (productos más vendidos, rendimiento por empleado).
export function GraficoBarras({ datos, clave, nombre, etiqueta, formatoValor = (v) => v, columnas }) {
  const reducir = useReducedMotion();
  return (
    <figure className="grafico grafico-barras-h" aria-label={`Gráfico de barras: ${nombre}`}>
      <div className="grafico-area" style={{ height: Math.max(160, datos.length * 46 + 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }} barCategoryGap="30%">
            <CartesianGrid horizontal={false} stroke="var(--linea-suave)" />
            <XAxis type="number" {...EJE} axisLine={false} allowDecimals={false} tickFormatter={(v) => (formatoValor === formatearPrecio ? `₡${compacto.format(v)}` : v)} />
            <YAxis type="category" dataKey={etiqueta} {...EJE} axisLine={{ stroke: 'var(--borde)' }} width={150} />
            <Tooltip content={<CuadroDetalle formatoValor={formatoValor} />} cursor={{ fill: 'var(--fondo-hover)' }} />
            <Bar dataKey={clave} name={nombre} fill={COLOR_INGRESOS} radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={!reducir} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TablaDelGrafico columnas={columnas} filas={datos} />
    </figure>
  );
}
