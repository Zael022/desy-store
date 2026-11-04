// Rutas de empleados.
import { Router } from 'express';
import {
  listarEmpleados,
  obtenerEmpleado,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado
} from '../controllers/empleadoController.js';

const router = Router();

router.get('/', listarEmpleados);
router.get('/:id', obtenerEmpleado);
router.post('/', crearEmpleado);
router.put('/:id', actualizarEmpleado);
router.delete('/:id', eliminarEmpleado);

export default router;
