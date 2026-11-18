// Atajo para leer la sesión: const { usuario, cerrarSesion } = useAutenticacion();
import { useContext } from 'react';
import { ContextoAutenticacion } from '../context/contextoAutenticacion.js';

export function useAutenticacion() {
  const contexto = useContext(ContextoAutenticacion);
  if (!contexto) throw new Error('useAutenticacion debe usarse dentro de <ProveedorAutenticacion>.');
  return contexto;
}
