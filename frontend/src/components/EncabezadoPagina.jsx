// Título de cada página escrito como una ruta: "Inventario/ Productos".
// ruta: arreglo de textos, por ejemplo ['Inventario', 'Productos'].
export default function EncabezadoPagina({ ruta, descripcion }) {
  return (
    <header className="encabezado-pagina">
      <h1>
        {ruta.map((parte, indice) => (
          <span key={parte}>
            {parte}
            {indice < ruta.length - 1 && '/ '}
          </span>
        ))}
      </h1>
      {descripcion && <p>{descripcion}</p>}
    </header>
  );
}
