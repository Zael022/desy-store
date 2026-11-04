// Rutas de materiales.
import { Router } from 'express';
import {
  listarMateriales,
  obtenerMaterial,
  crearMaterial,
  actualizarMaterial,
  eliminarMaterial
} from '../controllers/materialController.js';

const router = Router();

router.get('/', listarMateriales);
router.get('/:id', obtenerMaterial);
router.post('/', crearMaterial);
router.put('/:id', actualizarMaterial);
router.delete('/:id', eliminarMaterial);

export default router;
