// Carga datos de la API con estados de "cargando", "error" y "recargar".
// Uso: const { datos, cargando, error, recargar } = useDatos(() => listarVentas(filtros), [filtros]);
import { useCallback, useEffect, useState } from 'react';

export function useDatos(cargar, dependencias = []) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    cargar()
      .then((datos) => activo && setEstado({ datos, cargando: false, error: null }))
      .catch((error) => activo && setEstado((anterior) => ({ ...anterior, cargando: false, error })));
    return () => {
      activo = false;
    };
    // "cargar" cambia en cada render; las dependencias reales las indica quien usa el hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, recarga]);

  const recargar = useCallback(() => {
    setEstado((anterior) => ({ ...anterior, cargando: true }));
    setRecarga((n) => n + 1);
  }, []);

  return { ...estado, recargar, setDatos: (datos) => setEstado((anterior) => ({ ...anterior, datos })) };
}
