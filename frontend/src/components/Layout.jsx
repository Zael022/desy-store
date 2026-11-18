// Estructura común de todas las páginas:
//   - Cabecera: botón de menú (☰), logo de Desy, buscador y accesos rápidos.
//   - Menú lateral que se abre con el botón ☰. Cada rol ve SOLO su menú.
//   - <Outlet />: el "hueco" donde React Router dibuja la página actual.
//   - Pie de página.
// Esconder enlaces es solo para que cada persona vea lo suyo: el backend igual
// bloquea lo que su rol no puede hacer.
import { Fragment, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router';
import {
  ArrowLeftRight,
  ChartLine,
  ClipboardList,
  History,
  Home,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Store,
  Tags,
  Truck,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  X
} from 'lucide-react';
import Modal from './Modal.jsx';
import BuscadorCabecera from './BuscadorCabecera.jsx';
import PiePagina from './PiePagina.jsx';
import { useAutenticacion } from '../hooks/useAutenticacion.js';
import { usePedido } from '../hooks/usePedido.js';
import { resumenPedidos } from '../services/pedidosService.js';
import { INICIO_POR_ROL, NOMBRES_ROLES } from '../context/contextoAutenticacion.js';
// Vite convierte este import en la dirección final de la imagen del logo.
import logoDesy from '../assets/logo-desy.png';

const GESTION = [
  { ruta: '/admin/productos', texto: 'Productos', icono: Package },
  { ruta: '/admin/movimientos', texto: 'Movimientos', icono: ArrowLeftRight },
  { ruta: '/admin/categorias', texto: 'Categorías', icono: Tags },
  { ruta: '/admin/proveedores', texto: 'Proveedores', icono: Truck },
  { ruta: '/admin/materiales', texto: 'Materiales', icono: Layers },
  { ruta: '/admin/empleados', texto: 'Empleados', icono: Users },
  { ruta: '/pos/pedidos', texto: 'Pedidos de clientes', icono: PackageCheck, contador: 'pedidos' },
  { ruta: '/admin/ventas', texto: 'Ventas y devoluciones', icono: Receipt },
  { ruta: '/admin/abastecimiento', texto: 'Abastecimiento', icono: ClipboardList },
  { ruta: '/admin/usuarios', texto: 'Usuarios', icono: UsersRound },
  { ruta: '/admin/auditoria', texto: 'Auditoría', icono: History },
  { ruta: '/pos', texto: 'Punto de venta', icono: ShoppingBag }
];

// Menú de cada rol. "grupo" agrupa los enlaces con un subtítulo.
const MENUS = {
  visitante: [
    { ruta: '/', texto: 'Inicio', icono: Home },
    { ruta: '/catalogo', texto: 'Catálogo', icono: Store },
    { ruta: '/pedido', texto: 'Mi pedido', icono: ShoppingBasket, contador: 'carrito' },
    { ruta: '/login', texto: 'Iniciar sesión', icono: LogIn },
    { ruta: '/registro', texto: 'Crear cuenta', icono: UserPlus }
  ],
  cliente: [
    { ruta: '/', texto: 'Inicio', icono: Home },
    { ruta: '/catalogo', texto: 'Catálogo', icono: Store },
    { ruta: '/pedido', texto: 'Mi pedido', icono: ShoppingBasket, contador: 'carrito' },
    { ruta: '/cliente/pedidos', texto: 'Mis pedidos', icono: PackageCheck },
    { ruta: '/cliente', texto: 'Mis compras', icono: Receipt },
    { ruta: '/perfil', texto: 'Perfil y seguridad', icono: ShieldCheck }
  ],
  proveedor: [
    { ruta: '/proveedor', texto: 'Mi portal', icono: Truck },
    { ruta: '/perfil', texto: 'Perfil y seguridad', icono: ShieldCheck }
  ],
  ventas: [
    { ruta: '/pos', texto: 'Punto de venta', icono: ShoppingBag },
    { ruta: '/pos/pedidos', texto: 'Pedidos de clientes', icono: PackageCheck, contador: 'pedidos' },
    { ruta: '/pos/ventas', texto: 'Mis ventas', icono: Receipt },
    { ruta: '/catalogo', texto: 'Catálogo', icono: Store },
    { ruta: '/perfil', texto: 'Perfil y seguridad', icono: ShieldCheck }
  ],
  administrador: [
    { ruta: '/admin', texto: 'Panel administrativo', icono: LayoutDashboard },
    ...GESTION,
    { ruta: '/perfil', texto: 'Perfil y seguridad', icono: ShieldCheck }
  ],
  duena: [
    { ruta: '/duena', texto: 'Dashboard ejecutivo', icono: ChartLine },
    { ruta: '/admin', texto: 'Panel operativo', icono: LayoutDashboard },
    ...GESTION,
    { ruta: '/duena/configuracion', texto: 'Configuración', icono: Settings },
    { ruta: '/perfil', texto: 'Perfil y seguridad', icono: ShieldCheck }
  ]
};

// Accesos rápidos de la cabecera según el rol.
const ACCESOS = {
  visitante: [
    { ruta: '/login', texto: ['Iniciar', 'sesión'], icono: LogIn },
    { ruta: '/registro', texto: ['Crear', 'cuenta'], icono: UserPlus },
    { ruta: '/pedido', texto: ['Mi', 'pedido'], icono: ShoppingBasket, contador: 'carrito' }
  ],
  cliente: [
    { ruta: '/cliente/pedidos', texto: ['Mis', 'pedidos'], icono: PackageCheck },
    { ruta: '/pedido', texto: ['Mi', 'pedido'], icono: ShoppingBasket, contador: 'carrito' }
  ],
  proveedor: [{ ruta: '/proveedor', texto: ['Mi', 'portal'], icono: Truck }],
  ventas: [
    { ruta: '/pos/pedidos', texto: ['Pedidos de', 'clientes'], icono: PackageCheck, contador: 'pedidos' },
    { ruta: '/pos', texto: ['Punto de', 'venta'], icono: ShoppingBag }
  ],
  administrador: [{ ruta: '/admin/movimientos', texto: ['Registrar', 'movimiento'], icono: ArrowLeftRight }],
  duena: [{ ruta: '/duena', texto: ['Dashboard', 'ejecutivo'], icono: ChartLine }]
};

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const ubicacion = useLocation();
  const [parametros] = useSearchParams();
  const { usuario, cerrarSesion } = useAutenticacion();
  const rol = usuario?.rol ?? 'visitante';
  const esGestion = rol === 'administrador' || rol === 'duena';
  const esInterno = esGestion || rol === 'ventas';
  const { unidades } = usePedido();
  const [porConfirmar, setPorConfirmar] = useState(0);

  // Aviso de pedidos por confirmar (personal interno): se revisa al cambiar de página y cada minuto.
  useEffect(() => {
    if (!esInterno) return undefined;
    let activo = true;
    const revisar = () =>
      resumenPedidos()
        .then((r) => activo && setPorConfirmar(r.pendientes))
        .catch(() => {});
    revisar();
    const intervalo = setInterval(revisar, 60000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [esInterno, ubicacion.pathname]);

  // Número que acompaña a un enlace: artículos del pedido en armado o pedidos por confirmar.
  const contadorDe = (tipo) => (tipo === 'carrito' ? unidades : tipo === 'pedidos' ? porConfirmar : 0);

  // Al cambiar de página, la ventana vuelve arriba (como en cualquier sitio web).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [ubicacion.pathname]);

  const cerrarMenu = () => setMenuAbierto(false);
  const subtitulo = usuario && rol !== 'cliente' ? NOMBRES_ROLES[rol].toLowerCase() : 'tienda';
  const rutaBusqueda = esGestion ? '/admin/productos' : '/catalogo';

  return (
    <div className="aplicacion">
      <header className="cabecera">
        <div className="cabecera-contenido">
          <button type="button" className="boton-menu" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" aria-expanded={menuAbierto}>
            <Menu size={34} strokeWidth={2.4} aria-hidden="true" />
          </button>

          <Link to={usuario ? INICIO_POR_ROL[rol] : '/'} className="logo" aria-label="Desy, ir al inicio">
            <img src={logoDesy} alt="" className="logo-imagen" />
            <small>{subtitulo}</small>
          </Link>

          {rol !== 'proveedor' ? (
            // "key" hace que el buscador se reinicie cuando cambia la dirección (por ejemplo, al abrir un producto).
            <BuscadorCabecera
              key={ubicacion.pathname + ubicacion.search}
              modo={esGestion ? 'inventario' : 'catalogo'}
              textoInicial={ubicacion.pathname === rutaBusqueda ? (parametros.get('buscar') ?? '') : ''}
            />
          ) : (
            <span className="cabecera-espacio" />
          )}

          <nav className="accesos" aria-label="Accesos rápidos">
            {ACCESOS[rol].map(({ ruta, texto, icono: Icono, contador }, indice) => (
              <Fragment key={ruta}>
                {indice > 0 && <span className="accesos-separador" aria-hidden="true" />}
                <NavLink to={ruta} end className="acceso" aria-label={contadorDe(contador) > 0 ? `${texto.join(' ')} (${contadorDe(contador)})` : undefined}>
                  <span className="acceso-icono">
                    <Icono size={30} strokeWidth={1.8} aria-hidden="true" />
                    {contadorDe(contador) > 0 && (
                      <span className="acceso-contador" aria-hidden="true">
                        {contadorDe(contador)}
                      </span>
                    )}
                  </span>
                  <span>
                    {texto[0]}
                    <br />
                    {texto[1]}
                  </span>
                </NavLink>
              </Fragment>
            ))}
            {usuario && (
              <>
                <span className="accesos-separador" aria-hidden="true" />
                <NavLink to="/perfil" className="acceso acceso-usuario" title="Perfil y seguridad">
                  <UserRound size={30} strokeWidth={1.8} aria-hidden="true" />
                  <span>
                    {usuario.nombre?.split(' ')[0] ?? 'Mi cuenta'}
                    <br />
                    <small>{NOMBRES_ROLES[rol]}</small>
                  </span>
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Menú lateral (se cierra con Escape, con la X o con clic afuera). */}
      <Modal abierto={menuAbierto} alCerrar={cerrarMenu} variante="lateral" idTitulo="titulo-menu" className="menu-lateral">
        <div className="menu-lateral-encabezado">
          <p id="titulo-menu" className="logo logo-menu">
            <img src={logoDesy} alt="Desy" className="logo-imagen" />
            <small>{subtitulo}</small>
          </p>
          <button type="button" className="boton-menu" onClick={cerrarMenu} aria-label="Cerrar menú">
            <X size={28} aria-hidden="true" />
          </button>
        </div>
        {usuario && (
          <p className="menu-usuario">
            <strong>{usuario.nombre}</strong>
            <span>{NOMBRES_ROLES[rol]}</span>
          </p>
        )}
        <nav aria-label="Menú principal">
          <ul className="menu">
            {MENUS[rol].map(({ ruta, texto, icono: Icono, contador }) => (
              <li key={ruta}>
                <NavLink
                  to={ruta}
                  end={['/', '/admin', '/pos', '/duena'].includes(ruta)}
                  onClick={cerrarMenu}
                  className={({ isActive }) => (isActive ? 'menu-enlace activo' : 'menu-enlace')}
                >
                  <Icono size={20} aria-hidden="true" />
                  <span>{texto}</span>
                  {contadorDe(contador) > 0 && <span className="menu-contador">{contadorDe(contador)}</span>}
                </NavLink>
              </li>
            ))}
            {usuario && (
              <li>
                <button
                  type="button"
                  className="menu-enlace menu-salir"
                  onClick={() => {
                    cerrarMenu();
                    cerrarSesion();
                  }}
                >
                  <LogOut size={20} aria-hidden="true" />
                  <span>Cerrar sesión</span>
                </button>
              </li>
            )}
          </ul>
        </nav>
      </Modal>

      <main className="contenido">
        <Outlet />
      </main>

      <PiePagina rol={rol} />
    </div>
  );
}
