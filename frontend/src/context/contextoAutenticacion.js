// Contexto de autenticación: guarda quién inició sesión para toda la app.
// Analogía: es el "gafete" que muestra en cada pantalla quién es usted y su rol.
// Ojo: el gafete solo decide qué se MUESTRA. Quien decide qué se PUEDE hacer
// es siempre el backend (la matriz de permisos).
import { createContext } from 'react';

export const ContextoAutenticacion = createContext(null);

// Página principal de cada rol (igual que en el backend).
export const INICIO_POR_ROL = {
  cliente: '/cliente',
  proveedor: '/proveedor',
  ventas: '/pos',
  administrador: '/admin',
  duena: '/duena'
};

export const NOMBRES_ROLES = {
  cliente: 'Cliente',
  proveedor: 'Proveedor',
  ventas: 'Ventas',
  administrador: 'Administración',
  duena: 'Dueña'
};

export const ROLES_INTERNOS = ['ventas', 'administrador', 'duena'];
export const ROLES_GESTION = ['administrador', 'duena'];
