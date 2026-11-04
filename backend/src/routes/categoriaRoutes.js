// Rutas de categorías: une cada URL + método HTTP con su función del controlador.
import { Router } from 'express';
import {
  listarCategorias,
  obtenerCategoria,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
} from '../controllers/categoriaController.js';

const router = Router();

router.get('/', listarCategorias);
router.get('/:id', obtenerCategoria);
router.post('/', crearCategoria);
router.put('/:id', actualizarCategoria);
router.delete('/:id', eliminarCategoria);

export default router;
