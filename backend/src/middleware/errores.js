// Manejo centralizado de errores.
// Todos los errores terminan aquí y siempre se responde en JSON con el
// formato: { "message": "texto claro para la persona usuaria" }

// Error con código HTTP. Lo usamos para errores "esperados"
// (datos inválidos, registro inexistente, reglas del stock...).
export class ErrorHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Mensajes para cada restricción UNIQUE de script.sql.
const MENSAJES_DUPLICADOS = {
  uq_categorias_nombre: 'Ya existe una categoría con ese nombre.',
  uq_proveedores_nombre: 'Ya existe un proveedor con ese nombre.',
  uq_proveedores_correo: 'Ya existe un proveedor con ese correo.',
  uq_materiales_nombre: 'Ya existe un material con ese nombre.',
  uq_empleados_correo: 'Ya existe un empleado con ese correo.',
  uq_productos_codigo: 'Ya existe un producto con ese código.',
  uq_usuarios_correo: 'Ya existe una cuenta con ese correo.',
  uq_usuarios_empleado: 'Ese empleado ya tiene una cuenta de usuario.',
  uq_usuarios_proveedor: 'Ese proveedor ya tiene una cuenta de usuario.',
  uq_ventas_clave: 'Esa venta ya fue registrada.'
};

// Errores de conexión a MySQL (servidor apagado, contraseña incorrecta, BD inexistente).
const ERRORES_DE_CONEXION = ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ETIMEDOUT', 'ENOTFOUND'];

// Se usa cuando nadie atendió la ruta pedida.
export function rutaNoEncontrada(req, res) {
  res.status(404).json({ message: `La ruta ${req.method} ${req.originalUrl} no existe.` });
}

// Middleware de errores de Express (se reconoce porque recibe 4 parámetros).
export function manejadorErrores(error, req, res, _next) {
  // 1. Errores que lanzamos nosotros a propósito.
  if (error instanceof ErrorHttp) {
    return res.status(error.status).json({ message: error.message });
  }

  // 2. El cuerpo de la petición no es JSON válido (lo detecta express.json()).
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo de la petición no es un JSON válido.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Los datos enviados son demasiado grandes.' });
  }

  // 3. Errores de MySQL que tienen una explicación clara.
  if (error.code === 'ER_DUP_ENTRY') {
    const restriccion = Object.keys(MENSAJES_DUPLICADOS).find((nombre) => error.message.includes(nombre));
    const mensaje = restriccion ? MENSAJES_DUPLICADOS[restriccion] : 'Ya existe un registro con esos datos.';
    return res.status(409).json({ message: mensaje });
  }
  if (error.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ message: 'No se puede eliminar porque otros registros dependen de este.' });
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ message: 'Uno de los registros seleccionados no existe.' });
  }
  if (ERRORES_DE_CONEXION.includes(error.code)) {
    console.error('[MySQL] No se pudo conectar:', error.code, error.message);
    return res.status(500).json({ message: 'No se pudo conectar con la base de datos. Revise que MySQL esté encendido y los datos del archivo .env.' });
  }

  // 4. Cualquier otro error: se muestra en la consola del backend,
  //    pero a la persona usuaria NO se le envían detalles internos (SQL, credenciales...).
  console.error('[Error inesperado]', error);
  return res.status(500).json({ message: 'Ocurrió un error inesperado en el servidor.' });
}
