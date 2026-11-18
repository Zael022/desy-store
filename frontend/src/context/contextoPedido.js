// Contexto del pedido que el cliente está armando (como el carrito de una tienda en línea).
// Se guarda en este navegador (localStorage) hasta que se envía. Enviarlo es lo que
// aparta las unidades; mientras solo está aquí, no se aparta nada.
import { createContext } from 'react';

export const ContextoPedido = createContext(null);

export const MAXIMO_UNIDADES = 10; // igual que en el backend (por producto)
export const MAXIMO_PRODUCTOS = 20;
