// Estructura común de todas las páginas:
//   - Cabecera: botón de menú (☰), nombre de la tienda (Desy), buscador de productos y accesos rápidos.
//   - Menú lateral que se abre con el botón ☰.
//   - <Outlet />: el "hueco" donde React Router dibuja la página actual.
//   - Pie de página.
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router';
import { ArrowLeftRight, ChartColumn, Layers, LayoutDashboard, Menu, Package, Tags, Truck, Users, X } from 'lucide-react';
import Modal from './Modal.jsx';
import BuscadorCabecera from './BuscadorCabecera.jsx';
import PiePagina from './PiePagina.jsx';
// Vite convierte este import en la dirección final de la imagen del logo.
import logoDesy from '../assets/logo-desy.png';

const ENLACES = [
  { ruta: '/', texto: 'Inicio', icono: LayoutDashboard },
  { ruta: '/productos', texto: 'Productos', icono: Package },
  { ruta: '/movimientos', texto: 'Movimientos', icono: ArrowLeftRight },
  { ruta: '/categorias', texto: 'Categorías', icono: Tags },
  { ruta: '/proveedores', texto: 'Proveedores', icono: Truck },
  { ruta: '/materiales', texto: 'Materiales', icono: Layers },
  { ruta: '/empleados', texto: 'Empleados', icono: Users }
];

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const ubicacion = useLocation();
  const [parametros] = useSearchParams();

  // Al cambiar de página, la ventana vuelve arriba (como en cualquier sitio web).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [ubicacion.pathname]);

  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <div className="aplicacion">
      <header className="cabecera">
        <div className="cabecera-contenido">
          <button type="button" className="boton-menu" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" aria-expanded={menuAbierto}>
            <Menu size={34} strokeWidth={2.4} aria-hidden="true" />
          </button>

          <Link to="/" className="logo" aria-label="Desy · Inventario, ir al inicio">
            <img src={logoDesy} alt="" className="logo-imagen" />
            <small>inventario</small>
          </Link>

          {/* "key" hace que el buscador se reinicie cuando cambia la dirección (por ejemplo, al abrir un producto). */}
          <BuscadorCabecera
            key={ubicacion.pathname + ubicacion.search}
            textoInicial={ubicacion.pathname === '/productos' ? (parametros.get('buscar') ?? '') : ''}
          />

          <nav className="accesos" aria-label="Accesos rápidos">
            <NavLink to="/movimientos" className="acceso">
              <ArrowLeftRight size={30} strokeWidth={1.8} aria-hidden="true" />
              <span>
                Registrar
                <br />
                movimiento
              </span>
            </NavLink>
            <span className="accesos-separador" aria-hidden="true" />
            <NavLink to="/" end className="acceso">
              <ChartColumn size={30} strokeWidth={1.8} aria-hidden="true" />
              <span>
                Resumen
                <br />
                de stock
              </span>
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Menú lateral con todas las páginas (se cierra con Escape, con la X o con clic afuera). */}
      <Modal abierto={menuAbierto} alCerrar={cerrarMenu} variante="lateral" idTitulo="titulo-menu" className="menu-lateral">
        <div className="menu-lateral-encabezado">
          <p id="titulo-menu" className="logo logo-menu">
            <img src={logoDesy} alt="Desy" className="logo-imagen" />
            <small>inventario</small>
          </p>
          <button type="button" className="boton-menu" onClick={cerrarMenu} aria-label="Cerrar menú">
            <X size={28} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Menú principal">
          <ul className="menu">
            {ENLACES.map(({ ruta, texto, icono: Icono }) => (
              <li key={ruta}>
                <NavLink to={ruta} end={ruta === '/'} onClick={cerrarMenu} className={({ isActive }) => (isActive ? 'menu-enlace activo' : 'menu-enlace')}>
                  <Icono size={20} aria-hidden="true" />
                  <span>{texto}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </Modal>

      <main className="contenido">
        <Outlet />
      </main>

      <PiePagina />
    </div>
  );
}
