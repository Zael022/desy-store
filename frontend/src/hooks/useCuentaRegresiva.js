// Cuenta regresiva en segundos (para "Reenviar código en 45 s" y "El código vence en 4:12").
import { useEffect, useState } from 'react';

// segundosIniciales: si se pasa, la cuenta empieza al abrir la pantalla.
export function useCuentaRegresiva(segundosIniciales = 0) {
  const [fin, setFin] = useState(() => (segundosIniciales > 0 ? Date.now() + segundosIniciales * 1000 : null));
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!fin) return undefined;
    const intervalo = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(intervalo);
  }, [fin]);

  const restantes = fin ? Math.max(0, Math.ceil((fin - ahora) / 1000)) : 0;
  const iniciar = (segundos) => {
    setAhora(Date.now());
    setFin(Date.now() + segundos * 1000);
  };
  return { restantes, iniciar, detener: () => setFin(null) };
}

// 252 -> "4:12"
export function formatearSegundos(segundos) {
  const minutos = Math.floor(segundos / 60);
  return `${minutos}:${String(segundos % 60).padStart(2, '0')}`;
}
