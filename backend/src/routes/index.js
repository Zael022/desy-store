// Reúne todas las rutas de la API bajo el prefijo /api (ver app.js).
import { Router } from 'express';
import categoriaRoutes from './categoriaRoutes.js';
import proveedorRoutes from './proveedorRoutes.js';
import materialRoutes from './materialRoutes.js';
import empleadoRoutes from './empleadoRoutes.js';
import productoRoutes from './productoRoutes.js';
import movimientoRoutes from './movimientoRoutes.js';
import { obtenerConfiguracion, verificarSalud } from '../controllers/configuracionController.js';

const router = Router();

router.get('/salud', verificarSalud);
router.get('/configuracion', obtenerConfiguracion);

router.use('/categorias', categoriaRoutes);
router.use('/proveedores', proveedorRoutes);
router.use('/materiales', materialRoutes);
router.use('/empleados', empleadoRoutes);
router.use('/productos', productoRoutes);
router.use('/movimientos', movimientoRoutes);

export default router;
