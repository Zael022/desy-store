// Atajo para el pedido en armado: const { lineas, agregar, cambiar, quitar, vaciar } = usePedido();
import { useContext } from 'react';
import { ContextoPedido } from '../context/contextoPedido.js';

export function usePedido() {
  const contexto = useContext(ContextoPedido);
  if (!contexto) throw new Error('usePedido debe usarse dentro de <ProveedorPedido>.');
  return contexto;
}
