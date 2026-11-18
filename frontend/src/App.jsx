// Componente principal. Prepara lo que usan todas las páginas:
// - BrowserRouter: permite navegar entre páginas sin recargar.
// - ProveedorAutenticacion: sabe quién inició sesión (y su rol).
// - ProveedorPedido: el pedido que el cliente está armando ("Mi pedido").
// - MotionConfig reducedMotion="user": respeta "reducir movimiento" del sistema.
// - Toaster: el lugar donde aparecen las notificaciones (toasts).
// Luego entrega el control a las rutas (src/routes/AppRoutes.jsx).
import { BrowserRouter } from 'react-router';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'react-hot-toast';
import AppRoutes from './routes/AppRoutes.jsx';
import ProveedorAutenticacion from './context/ProveedorAutenticacion.jsx';
import ProveedorPedido from './context/ProveedorPedido.jsx';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ProveedorAutenticacion>
          <ProveedorPedido>
            <AppRoutes />
          </ProveedorPedido>
        </ProveedorAutenticacion>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: 'toast',
          error: { duration: 6000 }
        }}
      />
    </MotionConfig>
  );
}
