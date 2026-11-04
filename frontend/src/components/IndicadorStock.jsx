// Muestra el stock como "18 / 67" con una barrita que se llena.
// Cambia de estilo cuando está agotado (0) o casi lleno (90 % o más del máximo).
export default function IndicadorStock({ stock, maximo }) {
  const porcentaje = maximo > 0 ? Math.min(100, Math.round((stock / maximo) * 100)) : 0;
  let estado = 'normal';
  let texto = '';
  if (stock === 0) {
    estado = 'agotado';
    texto = 'Agotado';
  } else if (porcentaje >= 90) {
    estado = 'lleno';
    texto = 'Casi lleno';
  }

  return (
    <div className={`indicador-stock indicador-${estado}`}>
      <span className="indicador-numero">
        {stock} / {maximo}
      </span>
      <span className="indicador-barra" aria-hidden="true">
        <span style={{ width: `${porcentaje}%` }} />
      </span>
      {texto && <span className="indicador-texto">{texto}</span>}
    </div>
  );
}
