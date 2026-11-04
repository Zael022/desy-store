// Buscador grande de la cabecera, con sugerencias mientras se escribe.
// - Al escribir, muestra hasta 6 productos que coinciden (clic = abre su ficha).
// - Al presionar Enter o la lupa, abre /productos?buscar=texto con todos los resultados.
// La lista de productos se pide a la API la primera vez que se usa el buscador.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { listarProductos } from '../services/productosService.js';
import { formatearPrecio, normalizar } from '../utils/formato.js';

const MAXIMO_SUGERENCIAS = 6;

export default function BuscadorCabecera({ textoInicial = '' }) {
  const [texto, setTexto] = useState(textoInicial);
  const [productos, setProductos] = useState(null); // null = todavía no se han pedido
  const [abierto, setAbierto] = useState(false);
  const navegar = useNavigate();

  // Pide los productos una sola vez (la primera vez que se enfoca el buscador).
  function cargarProductos() {
    if (productos !== null) return;
    setProductos([]);
    listarProductos()
      .then(setProductos)
      .catch(() => setProductos([])); // si falla, simplemente no hay sugerencias
  }

  function buscar(evento) {
    evento.preventDefault();
    setAbierto(false);
    const limpio = texto.trim();
    navegar(limpio ? `/productos?buscar=${encodeURIComponent(limpio)}` : '/productos');
  }

  const buscado = normalizar(texto.trim());
  const sugerencias =
    buscado.length >= 2 && productos
      ? productos.filter((p) => normalizar(`${p.nombre} ${p.codigo} ${p.nombre_categoria}`).includes(buscado)).slice(0, MAXIMO_SUGERENCIAS)
      : [];
  const mostrarLista = abierto && buscado.length >= 2;

  return (
    <form
      className="buscador"
      role="search"
      onSubmit={buscar}
      onFocus={() => {
        cargarProductos();
        setAbierto(true);
      }}
      onBlur={(evento) => {
        // Se cierra solo si el foco salió del buscador (no si pasó a una sugerencia).
        if (!evento.currentTarget.contains(evento.relatedTarget)) setAbierto(false);
      }}
      onKeyDown={(evento) => evento.key === 'Escape' && setAbierto(false)}
    >
      <input
        name="buscar"
        type="search"
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          setAbierto(true);
        }}
        placeholder="¿Qué producto buscás?"
        aria-label="Buscar productos por nombre o código"
        autoComplete="off"
        aria-controls="sugerencias-busqueda"
        aria-expanded={mostrarLista}
      />
      <button type="submit" aria-label="Buscar">
        <Search size={26} strokeWidth={2.2} aria-hidden="true" />
      </button>

      {mostrarLista && (
        <ul id="sugerencias-busqueda" className="sugerencias" aria-label="Sugerencias de productos">
          {sugerencias.length === 0 ? (
            <li className="sugerencia-vacia">No hay productos con “{texto.trim()}”.</li>
          ) : (
            sugerencias.map((p) => (
              <li key={p.id_producto}>
                <Link to={`/productos/${p.id_producto}`} className="sugerencia" onClick={() => setAbierto(false)}>
                  <span className="sugerencia-nombre">{p.nombre}</span>
                  <span className="sugerencia-detalle">
                    {p.codigo} · <strong>{formatearPrecio(p.precio)}</strong> · stock {p.stock}
                  </span>
                </Link>
              </li>
            ))
          )}
          <li>
            <button type="submit" className="sugerencia sugerencia-todos">
              Ver todos los resultados para “{texto.trim()}”
            </button>
          </li>
        </ul>
      )}
    </form>
  );
}
