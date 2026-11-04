// Gráfico de barras (Recharts) con el stock real de cada producto
// y una línea punteada que marca el stock máximo permitido.
// Los datos llegan por props desde la página de Inicio, que los pide a la API.
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'motion/react';

// Cuadro que aparece al pasar el mouse sobre una barra.
function DetalleBarra({ active, payload, stockMaximo }) {
  if (!active || !payload || payload.length === 0) return null;
  const producto = payload[0].payload;
  return (
    <div className="grafico-tooltip">
      <strong>{producto.nombre}</strong>
      <span>Código: {producto.codigo}</span>
      <span>
        Stock: {producto.stock} de {stockMaximo}
        {producto.stock === 0 && ' (agotado)'}
      </span>
    </div>
  );
}

export default function GraficoStock({ productos, stockMaximo }) {
  // Si la persona pidió reducir el movimiento, el gráfico aparece sin animación.
  const reducirMovimiento = useReducedMotion();
  const datos = productos.map((p) => ({ codigo: p.codigo, nombre: p.nombre, stock: p.stock }));

  return (
    <figure className="grafico" aria-label={`Gráfico de barras del stock de ${datos.length} productos, con el máximo de ${stockMaximo} unidades`}>
      <div className="grafico-area">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 24, right: 16, bottom: 8, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--linea-suave)" />
            <XAxis dataKey="codigo" tickLine={false} axisLine={{ stroke: 'var(--borde)' }} tick={{ fill: 'var(--texto-secundario)', fontSize: 12 }} interval={0} angle={-35} textAnchor="end" height={56} />
            <YAxis domain={[0, stockMaximo]} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--texto-secundario)', fontSize: 12 }} width={36} />
            <Tooltip content={<DetalleBarra stockMaximo={stockMaximo} />} cursor={{ fill: 'var(--fondo-hover)' }} />
            <ReferenceLine
              y={stockMaximo}
              stroke="var(--texto-secundario)"
              strokeDasharray="6 4"
              strokeWidth={2}
              ifOverflow="extendDomain"
              label={{ value: `Máximo: ${stockMaximo}`, position: 'insideTopRight', fill: 'var(--texto-principal)', fontSize: 12, dy: -18 }}
            />
            <Bar dataKey="stock" name="Stock" fill="var(--serie-1)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={!reducirMovimiento} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Los mismos datos en una tabla, para quien no puede ver el gráfico. */}
      <details className="grafico-tabla">
        <summary>Ver los datos del gráfico en una tabla</summary>
        <table className="tabla tabla-compacta">
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Producto</th>
              <th scope="col">Stock</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((p) => (
              <tr key={p.codigo}>
                <td>{p.codigo}</td>
                <td>{p.nombre}</td>
                <td>
                  {p.stock} / {stockMaximo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
