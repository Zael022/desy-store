// Pedidos de clientes.
import { api, consulta } from './api.js';

// Cliente
export const listarMisPedidos = () => api.obtener('/mis-pedidos');
export const obtenerMiPedido = (id) => api.obtener(`/mis-pedidos/${id}`);
export const crearPedido = (datos) => api.crear('/mis-pedidos', datos);
export const cancelarMiPedido = (id) => api.parchar(`/mis-pedidos/${id}/cancelar`);

// Tienda (ventas, administración y dueña)
export const listarPedidos = (filtro) => api.obtener(`/pedidos${consulta({ filtro })}`);
export const resumenPedidos = () => api.obtener('/pedidos/resumen');
export const confirmarPedido = (id) => api.parchar(`/pedidos/${id}/confirmar`);
export const rechazarPedido = (id, motivo) => api.parchar(`/pedidos/${id}/rechazar`, { motivo });
export const entregarPedido = (id) => api.parchar(`/pedidos/${id}/entregar`);
