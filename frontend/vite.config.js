// Configuración de Vite (el servidor de desarrollo y el empaquetador del frontend).
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const entorno = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: {
      // Siempre el puerto 5173: es el origen permitido en CORS_ORIGIN del backend.
      // strictPort hace que Vite avise si el puerto está ocupado en lugar de usar otro.
      port: 5173,
      strictPort: true,
      // "Proxy": el navegador pide /api/... a Vite (puerto 5173) y Vite se lo pasa al
      // backend (puerto 3000). Así, para el navegador todo es un solo sitio y las
      // cookies de sesión (HttpOnly, SameSite) funcionan sin trucos.
      proxy: {
        '/api': { target: entorno.VITE_BACKEND_URL || 'http://localhost:3000', changeOrigin: false }
      }
    },
    build: {
      // Recharts y Motion hacen que el archivo final pese unos 900 kB (unos 270 kB comprimido).
      // Para este proyecto no hace falta dividirlo, así que subimos el límite del aviso.
      chunkSizeWarningLimit: 1100
    }
  };
});
