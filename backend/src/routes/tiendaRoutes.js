// Rutas de la tienda: catálogo público, compras del cliente, punto de venta,
// ventas, devoluciones, portal del proveedor y abastecimiento.
import { Router } from 'express';
import * as catalogo from '../controllers/catalogoController.js';
import * as ventas from '../controllers/ventaController.js';
import * as portal from '../controllers/portalProveedorController.js';
import * as abastecimiento from '../controllers/abastecimientoController.js';
import * as pedidos from '../controllers/pedidoController.js';

export const catalogoRoutes = Router()
  .get('/', catalogo.listarCatalogo)
  .get('/filtros', catalogo.obtenerFiltros)
  .get('/:id', catalogo.obtenerProductoCatalogo);

export const misComprasRoutes = Router()
  .get('/', ventas.listarMisCompras)
  .get('/:id', ventas.obtenerMiCompra);

// Pedidos: el cliente hace y cancela los suyos; la tienda los confirma, rechaza y entrega.
export const misPedidosRoutes = Router()
  .get('/', pedidos.listarMisPedidos)
  .post('/', pedidos.crearPedido)
  .get('/:id', pedidos.obtenerMiPedido)
  .patch('/:id/cancelar', pedidos.cancelarMiPedido);

export const pedidosRoutes = Router()
  .get('/', pedidos.listarPedidos)
  .get('/resumen', pedidos.resumenPedidos)
  .get('/:id', pedidos.obtenerPedido)
  .patch('/:id/confirmar', pedidos.confirmarPedido)
  .patch('/:id/rechazar', pedidos.rechazarPedido)
  .patch('/:id/entregar', pedidos.entregarPedido);

export const puntoVentaRoutes = Router()
  .get('/productos', ventas.buscarProductosPos)
  .get('/clientes', ventas.buscarClientesPos);

export const ventasRoutes = Router()
  .post('/', ventas.crearVenta)
  .get('/', ventas.listarVentas)
  .get('/:id', ventas.obtenerVenta);

export const devolucionesRoutes = Router()
  .post('/', ventas.crearDevolucion)
  .get('/', ventas.listarDevoluciones);

export const portalProveedorRoutes = Router()
  .get('/productos', portal.listarMisProductos)
  .get('/datos', portal.obtenerMisDatos)
  .put('/datos', portal.actualizarMisDatos)
  .get('/solicitudes', portal.listarMisSolicitudes)
  .get('/solicitudes/:id', portal.obtenerMiSolicitud)
  .patch('/solicitudes/:id/respuesta', portal.responderSolicitud);

export const abastecimientoRoutes = Router()
  .get('/', abastecimiento.listarSolicitudes)
  .post('/', abastecimiento.crearSolicitud)
  .get('/:id', abastecimiento.obtenerSolicitud)
  .patch('/:id/recibir', abastecimiento.recibirSolicitud)
  .patch('/:id/cancelar', abastecimiento.cancelarSolicitud);
