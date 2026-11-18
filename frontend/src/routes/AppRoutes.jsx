// Configuración de React Router: qué página se muestra en cada dirección.
// Todas las páginas van dentro de <Layout />, que dibuja el menú del rol.
// <RutaPrivada roles=[...]> esconde las pantallas que el rol no usa
// (la protección real la hace el backend en cada petición).
import { Route, Routes } from 'react-router';
import Layout from '../components/Layout.jsx';
import RutaPrivada from './RutaPrivada.jsx';
import { ROLES_GESTION, ROLES_INTERNOS } from '../context/contextoAutenticacion.js';
// Públicas
import BienvenidaPage from '../pages/tienda/BienvenidaPage.jsx';
import CatalogoPage from '../pages/tienda/CatalogoPage.jsx';
import ProductoPublicoPage from '../pages/tienda/ProductoPublicoPage.jsx';
import MiPedidoPage from '../pages/tienda/MiPedidoPage.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import RegistroPage from '../pages/auth/RegistroPage.jsx';
import VerificarCorreoPage from '../pages/auth/VerificarCorreoPage.jsx';
import MfaPage from '../pages/auth/MfaPage.jsx';
import RecuperarPage from '../pages/auth/RecuperarPage.jsx';
import RestablecerPage from '../pages/auth/RestablecerPage.jsx';
import InvitacionPage from '../pages/auth/InvitacionPage.jsx';
// Por rol
import PerfilPage from '../pages/PerfilPage.jsx';
import ClientePortalPage from '../pages/portales/ClientePortalPage.jsx';
import ProveedorPortalPage from '../pages/portales/ProveedorPortalPage.jsx';
import PuntoVentaPage from '../pages/ventas/PuntoVentaPage.jsx';
import VentasPage from '../pages/ventas/VentasPage.jsx';
import PedidosPage from '../pages/ventas/PedidosPage.jsx';
import PanelAdminPage from '../pages/admin/PanelAdminPage.jsx';
import AbastecimientoPage from '../pages/admin/AbastecimientoPage.jsx';
import UsuariosPage from '../pages/admin/UsuariosPage.jsx';
import AuditoriaPage from '../pages/admin/AuditoriaPage.jsx';
import DashboardDuenaPage from '../pages/duena/DashboardDuenaPage.jsx';
import ConfiguracionPage from '../pages/duena/ConfiguracionPage.jsx';
// Inventario original (ahora en /admin/...)
import ProductosPage from '../pages/ProductosPage.jsx';
import ProductoDetallePage from '../pages/ProductoDetallePage.jsx';
import MovimientosPage from '../pages/MovimientosPage.jsx';
import CategoriasPage from '../pages/CategoriasPage.jsx';
import ProveedoresPage from '../pages/ProveedoresPage.jsx';
import MaterialesPage from '../pages/MaterialesPage.jsx';
import EmpleadosPage from '../pages/EmpleadosPage.jsx';
import NoEncontradaPage from '../pages/NoEncontradaPage.jsx';

const privada = (roles, elemento) => <RutaPrivada roles={roles}>{elemento}</RutaPrivada>;

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Públicas */}
        <Route path="/" element={<BienvenidaPage />} />
        <Route path="/catalogo" element={<CatalogoPage />} />
        <Route path="/catalogo/:id" element={<ProductoPublicoPage />} />
        <Route path="/pedido" element={<MiPedidoPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/verificar-correo" element={<VerificarCorreoPage />} />
        <Route path="/mfa" element={<MfaPage />} />
        <Route path="/recuperar" element={<RecuperarPage />} />
        <Route path="/restablecer" element={<RestablecerPage />} />
        <Route path="/invitacion" element={<InvitacionPage />} />

        {/* Todas las cuentas */}
        <Route path="/perfil" element={privada(null, <PerfilPage />)} />

        {/* Cliente y proveedor */}
        <Route path="/cliente" element={privada(['cliente'], <ClientePortalPage />)} />
        <Route path="/cliente/pedidos" element={privada(['cliente'], <ClientePortalPage />)} />
        <Route path="/proveedor" element={privada(['proveedor'], <ProveedorPortalPage />)} />

        {/* Ventas (y personal interno) */}
        <Route path="/pos" element={privada(ROLES_INTERNOS, <PuntoVentaPage />)} />
        <Route path="/pos/ventas" element={privada(ROLES_INTERNOS, <VentasPage />)} />
        <Route path="/pos/pedidos" element={privada(ROLES_INTERNOS, <PedidosPage />)} />

        {/* Administración y dueña */}
        <Route path="/admin" element={privada(ROLES_GESTION, <PanelAdminPage />)} />
        <Route path="/admin/productos" element={privada(ROLES_GESTION, <ProductosPage />)} />
        <Route path="/admin/productos/:id" element={privada(ROLES_GESTION, <ProductoDetallePage />)} />
        <Route path="/admin/movimientos" element={privada(ROLES_GESTION, <MovimientosPage />)} />
        <Route path="/admin/categorias" element={privada(ROLES_GESTION, <CategoriasPage />)} />
        <Route path="/admin/proveedores" element={privada(ROLES_GESTION, <ProveedoresPage />)} />
        <Route path="/admin/materiales" element={privada(ROLES_GESTION, <MaterialesPage />)} />
        <Route path="/admin/empleados" element={privada(ROLES_GESTION, <EmpleadosPage />)} />
        <Route path="/admin/ventas" element={privada(ROLES_GESTION, <VentasPage />)} />
        <Route path="/admin/abastecimiento" element={privada(ROLES_GESTION, <AbastecimientoPage />)} />
        <Route path="/admin/usuarios" element={privada(ROLES_GESTION, <UsuariosPage />)} />
        <Route path="/admin/auditoria" element={privada(ROLES_GESTION, <AuditoriaPage />)} />

        {/* Solo dueña */}
        <Route path="/duena" element={privada(['duena'], <DashboardDuenaPage />)} />
        <Route path="/duena/configuracion" element={privada(['duena'], <ConfiguracionPage />)} />

        <Route path="*" element={<NoEncontradaPage />} />
      </Route>
    </Routes>
  );
}
