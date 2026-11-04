// Pie de página azul marino con accesos a todas las secciones.
import { Link } from 'react-router';
import logoDesy from '../assets/logo-desy.png';

export default function PiePagina() {
  return (
    <footer className="pie">
      <div className="pie-contenido">
        <div>
          {/* El logo va sobre una "tarjeta" blanca para que sus colores se vean bien sobre el azul. */}
          <p className="pie-logo">
            <img src={logoDesy} alt="Desy" />
          </p>
          <p className="pie-texto">Desy, tienda de bisutería y accesorios. Sistema de inventario · Mini Proyecto 1 · Node.js, React y MySQL.</p>
        </div>
        <nav aria-label="Catálogo">
          <h2>Catálogo</h2>
          <ul>
            <li>
              <Link to="/productos">Productos</Link>
            </li>
            <li>
              <Link to="/categorias">Categorías</Link>
            </li>
            <li>
              <Link to="/materiales">Materiales</Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Inventario">
          <h2>Inventario</h2>
          <ul>
            <li>
              <Link to="/movimientos">Entradas y salidas</Link>
            </li>
            <li>
              <Link to="/">Resumen de stock</Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Tienda">
          <h2>Tienda</h2>
          <ul>
            <li>
              <Link to="/proveedores">Proveedores</Link>
            </li>
            <li>
              <Link to="/empleados">Empleados</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
