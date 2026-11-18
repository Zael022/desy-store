// Rutas de productos.
import { Router } from 'express';
import {
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  eliminarProducto
} from '../controllers/productoController.js';
import { listarFotos, subirFoto, hacerPrincipal, marcarMedidas, eliminarFoto, recibirFoto } from '../controllers/fotoController.js';

const router = Router();

router.get('/', listarProductos);
router.get('/:id', obtenerProducto);
router.post('/', crearProducto);
router.put('/:id', actualizarProducto);
router.delete('/:id', eliminarProducto);

// Fotos de un producto
router.get('/:id/fotos', listarFotos);
router.post('/:id/fotos', recibirFoto, subirFoto);
router.patch('/:id/fotos/:idFoto/principal', hacerPrincipal);
router.patch('/:id/fotos/:idFoto/medidas', marcarMedidas);
router.delete('/:id/fotos/:idFoto', eliminarFoto);

export default router;
