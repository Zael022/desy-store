// Componente principal. Prepara lo que usan todas las páginas:
// - BrowserRouter: permite navegar entre páginas sin recargar.
// - MotionConfig reducedMotion="user": respeta "reducir movimiento" del sistema.
// - Toaster: el lugar donde aparecen las notificaciones (toasts).
// Luego entrega el control a las rutas (src/routes/AppRoutes.jsx).
import { BrowserRouter } from 'react-router';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'react-hot-toast';
import AppRoutes from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AppRoutes />
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
