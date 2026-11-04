// Tarjeta "Filtros" de la página de productos.
// No llama a la API: solo cambia los filtros y ProductosPage decide qué productos mostrar.
// En pantallas pequeñas la tarjeta se pliega y muestra un botón "Filtros (n)".
// filtros = { precioMin, precioMax, categorias: [ids], materiales: [ids], proveedores: [ids], disponibilidad }
import { useState } from 'react';
import { ChevronDown, FilterX } from 'lucide-react';
import SeccionFiltro from './SeccionFiltro.jsx';
import Boton from './Boton.jsx';

const OPCIONES_DISPONIBILIDAD = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'con-stock', texto: 'Con stock' },
  { valor: 'agotados', texto: 'Agotados' },
  { valor: 'casi-llenos', texto: 'Casi llenos (90 % del máximo)' }
];

// Lista de casillas (una por categoría, material o proveedor) con cuántos productos tiene cada una.
function ListaCasillas({ nombre, opciones, llave, seleccionados, productos, alCambiar }) {
  function alternar(id) {
    const nuevos = seleccionados.includes(id) ? seleccionados.filter((x) => x !== id) : [...seleccionados, id];
    alCambiar(nombre, nuevos);
  }

  return (
    <ul className="lista-casillas">
      {opciones.map((opcion) => {
        const id = opcion[llave];
        const cantidad = productos.filter((p) => p[llave] === id).length;
        return (
          <li key={id}>
            <label>
              <input type="checkbox" checked={seleccionados.includes(id)} onChange={() => alternar(id)} />
              <span>{opcion.nombre}</span>
              <span className="casilla-cantidad">{cantidad}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export default function FiltrosProductos({ filtros, alCambiar, alLimpiar, productos, categorias, materiales, proveedores }) {
  const [abiertoEnCelular, setAbiertoEnCelular] = useState(false);
  const precioActivo = (filtros.precioMin !== '' ? 1 : 0) + (filtros.precioMax !== '' ? 1 : 0);
  const totalActivos =
    precioActivo + filtros.categorias.length + filtros.materiales.length + filtros.proveedores.length + (filtros.disponibilidad !== 'todos' ? 1 : 0);

  return (
    <aside className={abiertoEnCelular ? 'tarjeta filtros abierto' : 'tarjeta filtros'} aria-labelledby="titulo-filtros">
      <h2 id="titulo-filtros" className="filtros-titulo">
        Filtros
      </h2>
      {/* Este botón solo se ve en pantallas pequeñas (ver index.css). */}
      <button type="button" className="filtros-alternar" onClick={() => setAbiertoEnCelular(!abiertoEnCelular)} aria-expanded={abiertoEnCelular} aria-controls="filtros-cuerpo">
        <span>Filtros{totalActivos > 0 && ` (${totalActivos})`}</span>
        <ChevronDown size={22} aria-hidden="true" className={abiertoEnCelular ? 'girado' : ''} />
      </button>

      <div id="filtros-cuerpo" className="filtros-cuerpo">
        <SeccionFiltro id="filtro-precio" titulo="Precio" activos={precioActivo}>
          <div className="filtro-precio">
            <label>
              Desde (₡)
              <input type="number" min="0" step="100" value={filtros.precioMin} onChange={(e) => alCambiar('precioMin', e.target.value)} placeholder="0" />
            </label>
            <label>
              Hasta (₡)
              <input type="number" min="0" step="100" value={filtros.precioMax} onChange={(e) => alCambiar('precioMax', e.target.value)} placeholder="Sin límite" />
            </label>
          </div>
        </SeccionFiltro>

        <SeccionFiltro id="filtro-categoria" titulo="Categoría" activos={filtros.categorias.length}>
          <ListaCasillas nombre="categorias" opciones={categorias} llave="id_categoria" seleccionados={filtros.categorias} productos={productos} alCambiar={alCambiar} />
        </SeccionFiltro>

        <SeccionFiltro id="filtro-material" titulo="Material" activos={filtros.materiales.length}>
          <ListaCasillas nombre="materiales" opciones={materiales} llave="id_material" seleccionados={filtros.materiales} productos={productos} alCambiar={alCambiar} />
        </SeccionFiltro>

        <SeccionFiltro id="filtro-proveedor" titulo="Proveedor" activos={filtros.proveedores.length}>
          <ListaCasillas nombre="proveedores" opciones={proveedores} llave="id_proveedor" seleccionados={filtros.proveedores} productos={productos} alCambiar={alCambiar} />
        </SeccionFiltro>

        <SeccionFiltro id="filtro-disponibilidad" titulo="Disponibilidad" activos={filtros.disponibilidad !== 'todos' ? 1 : 0}>
          <ul className="lista-casillas">
            {OPCIONES_DISPONIBILIDAD.map((opcion) => (
              <li key={opcion.valor}>
                <label>
                  <input
                    type="radio"
                    name="disponibilidad"
                    value={opcion.valor}
                    checked={filtros.disponibilidad === opcion.valor}
                    onChange={() => alCambiar('disponibilidad', opcion.valor)}
                  />
                  <span>{opcion.texto}</span>
                </label>
              </li>
            ))}
          </ul>
        </SeccionFiltro>

        {totalActivos > 0 && (
          <Boton variante="secundario" icono={FilterX} onClick={alLimpiar} className="boton-limpiar-filtros">
            Limpiar filtros ({totalActivos})
          </Boton>
        )}
      </div>
    </aside>
  );
}
