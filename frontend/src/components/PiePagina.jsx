// Pie de página con accesos a las secciones que el rol puede usar.
import { Link } from 'react-router';
import logoDesy from '../assets/logo-desy.png';

const SECCIONES = {
  publico: [
    { titulo: 'Tienda', enlaces: [{ ruta: '/', texto: 'Inicio' }, { ruta: '/catalogo', texto: 'Catálogo' }, { ruta: '/pedido', texto: 'Mi pedido' }] },
    { titulo: 'Mi cuenta', enlaces: [{ ruta: '/login', texto: 'Iniciar sesión' }, { ruta: '/registro', texto: 'Crear cuenta' }, { ruta: '/recuperar', texto: 'Olvidé mi contraseña' }] }
  ],
  cliente: [
    { titulo: 'Tienda', enlaces: [{ ruta: '/', texto: 'Inicio' }, { ruta: '/catalogo', texto: 'Catálogo' }, { ruta: '/pedido', texto: 'Mi pedido' }] },
    { titulo: 'Mi cuenta', enlaces: [{ ruta: '/cliente/pedidos', texto: 'Mis pedidos' }, { ruta: '/cliente', texto: 'Mis compras' }, { ruta: '/perfil', texto: 'Perfil y seguridad' }] }
  ],
  proveedor: [{ titulo: 'Proveedor', enlaces: [{ ruta: '/proveedor', texto: 'Mi portal' }, { ruta: '/perfil', texto: 'Perfil y seguridad' }] }],
  ventas: [
    { titulo: 'Ventas', enlaces: [{ ruta: '/pos', texto: 'Punto de venta' }, { ruta: '/pos/pedidos', texto: 'Pedidos de clientes' }, { ruta: '/pos/ventas', texto: 'Mis ventas' }] },
    { titulo: 'Mi cuenta', enlaces: [{ ruta: '/perfil', texto: 'Perfil y seguridad' }] }
  ],
  gestion: [
    { titulo: 'Catálogo', enlaces: [{ ruta: '/admin/productos', texto: 'Productos' }, { ruta: '/admin/categorias', texto: 'Categorías' }, { ruta: '/admin/materiales', texto: 'Materiales' }] },
    { titulo: 'Inventario', enlaces: [{ ruta: '/admin/movimientos', texto: 'Entradas y salidas' }, { ruta: '/admin/abastecimiento', texto: 'Abastecimiento' }, { ruta: '/admin', texto: 'Panel administrativo' }] },
    { titulo: 'Tienda', enlaces: [{ ruta: '/pos/pedidos', texto: 'Pedidos de clientes' }, { ruta: '/admin/ventas', texto: 'Ventas' }, { ruta: '/admin/proveedores', texto: 'Proveedores' }, { ruta: '/admin/usuarios', texto: 'Usuarios' }] }
  ]
};

export default function PiePagina({ rol = 'visitante' }) {
  const clave = ['administrador', 'duena'].includes(rol) ? 'gestion' : rol === 'visitante' ? 'publico' : rol;
  return (
    <footer className="pie">
      <div className="pie-contenido">
        <div>
          {/* El logo va sobre una "tarjeta" blanca para que sus colores se vean bien sobre el fondo oscuro. */}
          <p className="pie-logo">
            <img src={logoDesy} alt="Desy" />
          </p>
          <p className="pie-texto">Desy, tienda de bisutería y accesorios. Inventario, ventas y cuentas con verificación en dos pasos · Node.js, React y MySQL.</p>
        </div>
        {SECCIONES[clave].map((seccion) => (
          <nav key={seccion.titulo} aria-label={seccion.titulo}>
            <h2>{seccion.titulo}</h2>
            <ul>
              {seccion.enlaces.map((enlace) => (
                <li key={enlace.ruta}>
                  <Link to={enlace.ruta}>{enlace.texto}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
