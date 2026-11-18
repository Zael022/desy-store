// Punto de venta, ventas, devoluciones y compras del cliente.
import { api, consulta } from './api.js';

export const buscarProductosPos = (texto) => api.obtener(`/punto-venta/productos${consulta({ buscar: texto })}`);
export const buscarClientesPos = (texto) => api.obtener(`/punto-venta/clientes${consulta({ buscar: texto })}`);

export const crearVenta = (datos) => api.crear('/ventas', datos);
export const listarVentas = (filtros) => api.obtener(`/ventas${consulta(filtros)}`);
export const obtenerVenta = (id) => api.obtener(`/ventas/${id}`);

export const crearDevolucion = (datos) => api.crear('/devoluciones', datos);
export const listarDevoluciones = () => api.obtener('/devoluciones');

export const listarMisCompras = () => api.obtener('/mis-compras');
export const obtenerMiCompra = (id) => api.obtener(`/mis-compras/${id}`);
