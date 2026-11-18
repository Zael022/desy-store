// Proveedor del contexto de autenticación.
//   * Al abrir la app pregunta al backend si hay una sesión (GET /api/auth/sesion).
//   * Si la API avisa que la sesión venció (401), borra el usuario y lleva al
//     login con un mensaje.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { ContextoAutenticacion } from './contextoAutenticacion.js';
import { EVENTO_SESION_EXPIRADA } from '../services/api.js';
import { obtenerSesion, cerrarSesion as cerrarSesionApi } from '../services/authService.js';

export default function ProveedorAutenticacion({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  // Si el backend no responde al abrir la app, no sabemos si hay sesión:
  // se muestra "Error de conexión" con "Reintentar" en vez de mandar al login.
  const [errorConexion, setErrorConexion] = useState(null);
  // true justo después de "Cerrar sesión": así la página protegida en la que estaba
  // no se recuerda para la próxima persona que inicie sesión en este navegador.
  const [saliendo, setSaliendo] = useState(false);
  const navegar = useNavigate();
  const establecerUsuario = useCallback((datos) => {
    setSaliendo(false);
    setUsuario(datos);
  }, []);

  // El error de conexión se mantiene mientras se reintenta: así la pantalla no
  // salta al login por un instante mientras llega la respuesta.
  const recargarSesion = useCallback(async () => {
    try {
      const datos = await obtenerSesion();
      setUsuario(datos.usuario);
      setErrorConexion(null);
      return datos.usuario;
    } catch (error) {
      setUsuario(null);
      setErrorConexion(error.esDeConexion ? error : null);
      return null;
    } finally {
      setCargando(false);
    }
  }, []);

  // Al abrir la app: ¿hay una sesión abierta?
  useEffect(() => {
    let activo = true;
    obtenerSesion()
      .then((datos) => activo && setUsuario(datos.usuario))
      .catch((error) => {
        if (!activo) return;
        setUsuario(null);
        if (error.esDeConexion) setErrorConexion(error);
      })
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    function alExpirar(evento) {
      setUsuario((anterior) => {
        if (anterior) {
          toast.error(evento.detail || 'Su sesión expiró. Inicie sesión de nuevo.', { id: 'sesion-expirada' });
          navegar('/login', { replace: true, state: { mensaje: 'Su sesión expiró. Inicie sesión de nuevo.' } });
        }
        return null;
      });
    }
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, [navegar]);

  const cerrarSesion = useCallback(async () => {
    try {
      await cerrarSesionApi();
    } finally {
      setSaliendo(true);
      setUsuario(null);
      navegar('/login', { replace: true, state: { mensaje: 'Cerró sesión correctamente.' } });
    }
  }, [navegar]);

  const valor = useMemo(
    () => ({ usuario, cargando, errorConexion, saliendo, establecerUsuario, recargarSesion, cerrarSesion }),
    [usuario, cargando, errorConexion, saliendo, establecerUsuario, recargarSesion, cerrarSesion]
  );

  return <ContextoAutenticacion.Provider value={valor}>{children}</ContextoAutenticacion.Provider>;
}
