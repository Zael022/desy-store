// Configuración de Vite (el servidor de desarrollo y el empaquetador del frontend).
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Siempre el puerto 5173: es el origen permitido en CORS_ORIGIN del backend.
    // strictPort hace que Vite avise si el puerto está ocupado en lugar de usar otro.
    port: 5173,
    strictPort: true
  },
  build: {
    // Recharts y Motion hacen que el archivo final pese unos 830 kB (250 kB comprimido).
    // Para este proyecto no hace falta dividirlo, así que subimos el límite del aviso.
    chunkSizeWarningLimit: 1000
  }
});
