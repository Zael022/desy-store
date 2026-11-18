// Reúne todas las rutas de la API bajo el prefijo /api (ver app.js).
// OJO: antes de llegar aquí, middleware/autorizacion.js ya revisó la matriz de
// permisos (config/permisos.js). Una ruta que no esté en la matriz responde 404.
import { Router } from 'express';
import categoriaRoutes from './categoriaRoutes.js';
import proveedorRoutes from './proveedorRoutes.js';
import materialRoutes from './materialRoutes.js';
import empleadoRoutes from './empleadoRoutes.js';
import productoRoutes from './productoRoutes.js';
import movimientoRoutes from './movimientoRoutes.js';
import authRoutes from './authRoutes.js';
import perfilRoutes from './perfilRoutes.js';
import {
  catalogoRoutes,
  misComprasRoutes,
  misPedidosRoutes,
  pedidosRoutes,
  puntoVentaRoutes,
  ventasRoutes,
  devolucionesRoutes,
  portalProveedorRoutes,
  abastecimientoRoutes
} from './tiendaRoutes.js';
import { usuariosRoutes, reportesRoutes, auditoriaRoutes, configuracionSistemaRoutes } from './administracionRoutes.js';
import { obtenerConfiguracion, verificarSalud } from '../controllers/configuracionController.js';
import { servirFoto } from '../controllers/fotoController.js';

const router = Router();

router.get('/salud', verificarSalud);
router.get('/configuracion', obtenerConfiguracion);
router.get('/fotos/:archivo', servirFoto); // fotos de los productos (públicas)
router.use('/configuracion/sistema', configuracionSistemaRoutes);

router.use('/auth', authRoutes);
router.use('/perfil', perfilRoutes);

router.use('/catalogo', catalogoRoutes);
router.use('/mis-compras', misComprasRoutes);
router.use('/mis-pedidos', misPedidosRoutes);
router.use('/pedidos', pedidosRoutes);
router.use('/portal-proveedor', portalProveedorRoutes);
router.use('/punto-venta', puntoVentaRoutes);
router.use('/ventas', ventasRoutes);
router.use('/devoluciones', devolucionesRoutes);
router.use('/abastecimiento', abastecimientoRoutes);

router.use('/usuarios', usuariosRoutes);
router.use('/reportes', reportesRoutes);
router.use('/auditoria', auditoriaRoutes);

// Inventario original
router.use('/categorias', categoriaRoutes);
router.use('/proveedores', proveedorRoutes);
router.use('/materiales', materialRoutes);
router.use('/empleados', empleadoRoutes);
router.use('/productos', productoRoutes);
router.use('/movimientos', movimientoRoutes);

export default router;
