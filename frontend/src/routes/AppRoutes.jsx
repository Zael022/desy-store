// Configuración de React Router: qué página se muestra en cada dirección.
// Todas las páginas van dentro de <Layout />, que dibuja el menú.
import { Route, Routes } from 'react-router';
import Layout from '../components/Layout.jsx';
import InicioPage from '../pages/InicioPage.jsx';
import ProductosPage from '../pages/ProductosPage.jsx';
import ProductoDetallePage from '../pages/ProductoDetallePage.jsx';
import MovimientosPage from '../pages/MovimientosPage.jsx';
import CategoriasPage from '../pages/CategoriasPage.jsx';
import ProveedoresPage from '../pages/ProveedoresPage.jsx';
import MaterialesPage from '../pages/MaterialesPage.jsx';
import EmpleadosPage from '../pages/EmpleadosPage.jsx';
import NoEncontradaPage from '../pages/NoEncontradaPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<InicioPage />} />
        <Route path="/productos" element={<ProductosPage />} />
        <Route path="/productos/:id" element={<ProductoDetallePage />} />
        <Route path="/movimientos" element={<MovimientosPage />} />
        <Route path="/categorias" element={<CategoriasPage />} />
        <Route path="/proveedores" element={<ProveedoresPage />} />
        <Route path="/materiales" element={<MaterialesPage />} />
        <Route path="/empleados" element={<EmpleadosPage />} />
        <Route path="*" element={<NoEncontradaPage />} />
      </Route>
    </Routes>
  );
}
