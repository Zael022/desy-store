// Segundo paso del flujo: index.html carga este archivo,
// y este archivo dibuja <App /> dentro del <div id="root">.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Letra geométrica incluida en el proyecto (no se descarga de internet).
import '@fontsource-variable/urbanist';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
