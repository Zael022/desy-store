// =====================================================================
// MATRIZ DE PERMISOS: la única tabla que decide quién puede usar cada endpoint.
//
// El middleware "autorizar" (middleware/autorizacion.js) la revisa en CADA
// petición, antes de llegar a cualquier ruta:
//   * Si la ruta no está aquí -> 404 (lo que no está permitido, no existe).
//   * acceso 'publico'  -> pasa sin sesión.
//   * acceso 'desafio'  -> necesita el desafío MFA (contraseña correcta, sin código todavía).
//   * acceso [roles]    -> necesita sesión completa (contraseña + código) -> 401 si no hay;
//                          y que el rol esté en la lista -> 403 si no está.
//
// docs/matriz-de-permisos.md se genera desde esta tabla con: npm run matriz
// "restriccion" explica las reglas de "solo lo suyo" que aplica además el controlador.
// =====================================================================

export const ROLES = ['cliente', 'proveedor', 'ventas', 'administrador', 'duena'];
export const NOMBRES_ROLES = {
  cliente: 'Cliente',
  proveedor: 'Proveedor',
  ventas: 'Ventas',
  administrador: 'Administrador',
  duena: 'Dueña'
};
export const ROLES_INTERNOS = ['ventas', 'administrador', 'duena'];

const TODOS = ROLES;
const INTERNOS = ROLES_INTERNOS;
const GESTION = ['administrador', 'duena'];
const DUENA = ['duena'];

// Los 5 endpoints CRUD originales de cada entidad del inventario.
function crudOriginal(entidad, nombre) {
  return [
    { metodo: 'GET', ruta: `/api/${entidad}`, acceso: GESTION, descripcion: `Listar ${nombre}` },
    { metodo: 'GET', ruta: `/api/${entidad}/:id`, acceso: GESTION, descripcion: `Ver un registro de ${nombre}` },
    { metodo: 'POST', ruta: `/api/${entidad}`, acceso: GESTION, descripcion: `Crear en ${nombre}` },
    { metodo: 'PUT', ruta: `/api/${entidad}/:id`, acceso: GESTION, descripcion: `Editar en ${nombre}` },
    { metodo: 'DELETE', ruta: `/api/${entidad}/:id`, acceso: GESTION, descripcion: `Eliminar en ${nombre}` }
  ];
}

export const PERMISOS = [
  // ----- Generales -----
  { metodo: 'GET', ruta: '/api/salud', acceso: 'publico', descripcion: 'Comprobar que la API y MySQL responden' },
  { metodo: 'GET', ruta: '/api/configuracion', acceso: 'publico', descripcion: 'Stock máximo y umbral de "pocas unidades"' },
  { metodo: 'GET', ruta: '/api/fotos/:archivo', acceso: 'publico', descripcion: 'Ver la foto de un producto (imagen WebP)' },

  // ----- Autenticación -----
  { metodo: 'GET', ruta: '/api/auth/csrf', acceso: 'publico', descripcion: 'Obtener el token CSRF' },
  { metodo: 'POST', ruta: '/api/auth/registro', acceso: 'publico', descripcion: 'Registro de clientes (siempre rol cliente)' },
  { metodo: 'POST', ruta: '/api/auth/verificar-correo', acceso: 'publico', descripcion: 'Verificar el correo con el código' },
  { metodo: 'POST', ruta: '/api/auth/verificar-correo/reenviar', acceso: 'publico', descripcion: 'Pedir otro código de verificación de correo' },
  { metodo: 'POST', ruta: '/api/auth/login', acceso: 'publico', descripcion: 'Paso 1: correo y contraseña (crea el desafío MFA)' },
  { metodo: 'GET', ruta: '/api/auth/mfa/canales', acceso: 'desafio', descripcion: 'Canales verificados para recibir el código' },
  { metodo: 'POST', ruta: '/api/auth/mfa/enviar', acceso: 'desafio', descripcion: 'Paso 2: enviar el código por correo o SMS' },
  { metodo: 'POST', ruta: '/api/auth/mfa/verificar', acceso: 'desafio', descripcion: 'Paso 3: verificar el código y crear la sesión' },
  { metodo: 'POST', ruta: '/api/auth/logout', acceso: 'publico', descripcion: 'Cerrar sesión (revoca la sesión en el servidor)' },
  { metodo: 'GET', ruta: '/api/auth/sesion', acceso: TODOS, descripcion: 'Usuario de la sesión actual' },
  { metodo: 'POST', ruta: '/api/auth/recuperar', acceso: 'publico', descripcion: 'Pedir enlace para restablecer la contraseña' },
  { metodo: 'POST', ruta: '/api/auth/restablecer', acceso: 'publico', descripcion: 'Restablecer la contraseña con el enlace' },
  { metodo: 'POST', ruta: '/api/auth/invitacion/validar', acceso: 'publico', descripcion: 'Revisar un enlace de invitación' },
  { metodo: 'POST', ruta: '/api/auth/invitacion/aceptar', acceso: 'publico', descripcion: 'Definir la contraseña de una cuenta invitada' },

  // ----- Perfil y seguridad (cada quien el suyo) -----
  { metodo: 'GET', ruta: '/api/perfil', acceso: TODOS, descripcion: 'Ver el perfil y los canales verificados', restriccion: 'Solo el propio usuario' },
  { metodo: 'PUT', ruta: '/api/perfil/datos', acceso: ['cliente'], descripcion: 'Editar nombre y dirección del cliente', restriccion: 'Solo el propio cliente' },
  { metodo: 'PUT', ruta: '/api/perfil/contrasena', acceso: TODOS, descripcion: 'Cambiar la contraseña (pide la actual)', restriccion: 'Solo el propio usuario' },
  { metodo: 'POST', ruta: '/api/perfil/correo', acceso: TODOS, descripcion: 'Pedir cambio de correo (código al correo nuevo)', restriccion: 'Solo el propio usuario' },
  { metodo: 'POST', ruta: '/api/perfil/correo/confirmar', acceso: TODOS, descripcion: 'Confirmar el correo nuevo con el código', restriccion: 'Solo el propio usuario' },
  { metodo: 'POST', ruta: '/api/perfil/telefono', acceso: TODOS, descripcion: 'Pedir verificación de teléfono (código por SMS)', restriccion: 'Solo el propio usuario' },
  { metodo: 'POST', ruta: '/api/perfil/telefono/confirmar', acceso: TODOS, descripcion: 'Confirmar el teléfono con el código', restriccion: 'Solo el propio usuario' },
  { metodo: 'GET', ruta: '/api/perfil/sesiones', acceso: TODOS, descripcion: 'Ver las sesiones abiertas', restriccion: 'Solo las propias' },
  { metodo: 'POST', ruta: '/api/perfil/sesiones/cerrar-otras', acceso: TODOS, descripcion: 'Cerrar las demás sesiones', restriccion: 'Solo las propias' },

  // ----- Catálogo público (sin stock exacto, costos ni proveedores) -----
  { metodo: 'GET', ruta: '/api/catalogo', acceso: 'publico', descripcion: 'Catálogo con disponibilidad (sin stock exacto)' },
  { metodo: 'GET', ruta: '/api/catalogo/filtros', acceso: 'publico', descripcion: 'Categorías (con subcategorías), materiales y mensaje del catálogo' },
  { metodo: 'GET', ruta: '/api/catalogo/:id', acceso: 'publico', descripcion: 'Detalle de un producto del catálogo (con sus fotos)' },

  // ----- Cliente -----
  { metodo: 'GET', ruta: '/api/mis-compras', acceso: ['cliente'], descripcion: 'Historial de compras del cliente', restriccion: 'Solo ventas asociadas a su cuenta (desde la sesión)' },
  { metodo: 'GET', ruta: '/api/mis-compras/:id', acceso: ['cliente'], descripcion: 'Detalle de una compra propia', restriccion: 'Otra compra -> 404' },
  { metodo: 'GET', ruta: '/api/mis-pedidos', acceso: ['cliente'], descripcion: 'Pedidos del cliente', restriccion: 'Solo los suyos (cliente tomado de la sesión)' },
  { metodo: 'POST', ruta: '/api/mis-pedidos', acceso: ['cliente'], descripcion: 'Hacer un pedido: aparta las unidades hasta que la tienda responda (transacción + idempotencia)', restriccion: 'Máximo 3 pedidos en curso, 20 productos y 10 unidades por producto' },
  { metodo: 'GET', ruta: '/api/mis-pedidos/:id', acceso: ['cliente'], descripcion: 'Detalle de un pedido propio', restriccion: 'Otro pedido -> 404' },
  { metodo: 'PATCH', ruta: '/api/mis-pedidos/:id/cancelar', acceso: ['cliente'], descripcion: 'Cancelar un pedido propio pendiente o confirmado (libera las unidades)', restriccion: 'Otro pedido -> 404' },

  // ----- Proveedor -----
  { metodo: 'GET', ruta: '/api/portal-proveedor/productos', acceso: ['proveedor'], descripcion: 'Productos de su proveedor', restriccion: 'Proveedor tomado de la sesión' },
  { metodo: 'GET', ruta: '/api/portal-proveedor/datos', acceso: ['proveedor'], descripcion: 'Ver sus datos de contacto', restriccion: 'Proveedor tomado de la sesión' },
  { metodo: 'PUT', ruta: '/api/portal-proveedor/datos', acceso: ['proveedor'], descripcion: 'Actualizar sus datos de contacto', restriccion: 'Proveedor tomado de la sesión' },
  { metodo: 'GET', ruta: '/api/portal-proveedor/solicitudes', acceso: ['proveedor'], descripcion: 'Solicitudes de abastecimiento dirigidas a él', restriccion: 'Proveedor tomado de la sesión' },
  { metodo: 'GET', ruta: '/api/portal-proveedor/solicitudes/:id', acceso: ['proveedor'], descripcion: 'Detalle de una solicitud suya', restriccion: 'De otro proveedor -> 404' },
  { metodo: 'PATCH', ruta: '/api/portal-proveedor/solicitudes/:id/respuesta', acceso: ['proveedor'], descripcion: 'Aceptar o rechazar una solicitud pendiente', restriccion: 'De otro proveedor -> 404' },

  // ----- Punto de venta, ventas y devoluciones -----
  { metodo: 'GET', ruta: '/api/punto-venta/productos', acceso: INTERNOS, descripcion: 'Buscar productos con precio y stock' },
  { metodo: 'GET', ruta: '/api/punto-venta/clientes', acceso: INTERNOS, descripcion: 'Buscar clientes registrados' },
  { metodo: 'POST', ruta: '/api/ventas', acceso: INTERNOS, descripcion: 'Confirmar una venta (transacción + idempotencia)', restriccion: 'Vendedor y empleado tomados de la sesión' },
  { metodo: 'GET', ruta: '/api/ventas', acceso: INTERNOS, descripcion: 'Listar ventas', restriccion: 'Ventas: solo las propias. Administrador y dueña: todas' },
  { metodo: 'GET', ruta: '/api/ventas/:id', acceso: INTERNOS, descripcion: 'Detalle de una venta', restriccion: 'Ventas: venta ajena -> 404' },
  { metodo: 'GET', ruta: '/api/pedidos', acceso: INTERNOS, descripcion: 'Bandeja de pedidos de clientes (pendientes, confirmados, activos, historial)' },
  { metodo: 'GET', ruta: '/api/pedidos/resumen', acceso: INTERNOS, descripcion: 'Cuántos pedidos esperan confirmación o entrega' },
  { metodo: 'GET', ruta: '/api/pedidos/:id', acceso: INTERNOS, descripcion: 'Detalle de un pedido' },
  { metodo: 'PATCH', ruta: '/api/pedidos/:id/confirmar', acceso: INTERNOS, descripcion: 'Confirmar un pedido pendiente (queda listo para recoger; aviso por correo)' },
  { metodo: 'PATCH', ruta: '/api/pedidos/:id/rechazar', acceso: INTERNOS, descripcion: 'Rechazar un pedido pendiente o confirmado, con motivo (libera las unidades)' },
  { metodo: 'PATCH', ruta: '/api/pedidos/:id/entregar', acceso: INTERNOS, descripcion: 'Entregar y cobrar un pedido confirmado: registra la venta', restriccion: 'Empleado tomado de la sesión; se cobra el precio del pedido' },
  { metodo: 'POST', ruta: '/api/devoluciones', acceso: INTERNOS, descripcion: 'Registrar una devolución', restriccion: 'Ventas: solo de sus ventas' },
  { metodo: 'GET', ruta: '/api/devoluciones', acceso: INTERNOS, descripcion: 'Listar devoluciones', restriccion: 'Ventas: solo de sus ventas' },

  // ----- Inventario original (CRUDs) -----
  ...crudOriginal('categorias', 'categorías'),
  ...crudOriginal('proveedores', 'proveedores'),
  ...crudOriginal('materiales', 'materiales'),
  ...crudOriginal('empleados', 'empleados'),
  ...crudOriginal('productos', 'productos').map((regla) => ({
    ...regla,
    restriccion: 'El costo unitario solo lo ve y lo cambia la dueña'
  })),
  { metodo: 'GET', ruta: '/api/productos/:id/fotos', acceso: GESTION, descripcion: 'Listar las fotos de un producto' },
  { metodo: 'POST', ruta: '/api/productos/:id/fotos', acceso: GESTION, descripcion: 'Subir una foto (JPG, PNG o WebP, máx. 5 MB y 8 por producto; puede marcarse como foto con medidas)', restriccion: 'Se revisa y convierte a WebP sin datos ocultos (GPS)' },
  { metodo: 'PATCH', ruta: '/api/productos/:id/fotos/:idFoto/principal', acceso: GESTION, descripcion: 'Elegir la foto principal', restriccion: 'Una foto con medidas no puede ser la principal (409)' },
  { metodo: 'PATCH', ruta: '/api/productos/:id/fotos/:idFoto/medidas', acceso: GESTION, descripcion: 'Marcar o desmarcar una foto con medidas', restriccion: 'Las fotos con medidas van siempre al final' },
  { metodo: 'DELETE', ruta: '/api/productos/:id/fotos/:idFoto', acceso: GESTION, descripcion: 'Borrar una foto' },
  ...crudOriginal('movimientos', 'movimientos').map((regla) =>
    regla.metodo === 'PUT' || regla.metodo === 'DELETE'
      ? { ...regla, restriccion: 'Los movimientos de ventas, devoluciones o abastecimiento no se editan ni borran' }
      : regla
  ),

  // ----- Abastecimiento -----
  { metodo: 'GET', ruta: '/api/abastecimiento', acceso: GESTION, descripcion: 'Listar solicitudes de abastecimiento' },
  { metodo: 'GET', ruta: '/api/abastecimiento/:id', acceso: GESTION, descripcion: 'Detalle de una solicitud' },
  { metodo: 'POST', ruta: '/api/abastecimiento', acceso: GESTION, descripcion: 'Crear una solicitud a un proveedor' },
  { metodo: 'PATCH', ruta: '/api/abastecimiento/:id/recibir', acceso: GESTION, descripcion: 'Marcar como recibida (genera entradas)' },
  { metodo: 'PATCH', ruta: '/api/abastecimiento/:id/cancelar', acceso: GESTION, descripcion: 'Cancelar una solicitud pendiente o aceptada' },

  // ----- Usuarios y permisos -----
  { metodo: 'GET', ruta: '/api/usuarios', acceso: GESTION, descripcion: 'Listar cuentas' },
  { metodo: 'POST', ruta: '/api/usuarios/invitaciones', acceso: GESTION, descripcion: 'Crear una cuenta interna o de proveedor por invitación', restriccion: 'Administrador: solo ventas y proveedor. Dueña: cualquier rol interno o proveedor' },
  { metodo: 'POST', ruta: '/api/usuarios/:id/invitacion', acceso: GESTION, descripcion: 'Reenviar la invitación de una cuenta sin contraseña', restriccion: 'Misma regla de roles que al crear' },
  { metodo: 'PATCH', ruta: '/api/usuarios/:id/correo', acceso: GESTION, descripcion: 'Corregir el correo de una cuenta con invitación pendiente', restriccion: 'Misma regla de roles que al crear. Solo cuentas sin contraseña (las activas lo cambian desde su perfil con código)' },
  { metodo: 'PATCH', ruta: '/api/usuarios/:id/estado', acceso: GESTION, descripcion: 'Activar o desactivar una cuenta', restriccion: 'Administrador: solo ventas y proveedor. Nadie se desactiva a sí mismo' },
  { metodo: 'PATCH', ruta: '/api/usuarios/:id/rol', acceso: DUENA, descripcion: 'Cambiar el rol interno de una cuenta', restriccion: 'Solo roles internos. La única dueña activa no puede quitarse el rol' },

  // ----- Reportes, auditoría y configuración -----
  { metodo: 'GET', ruta: '/api/reportes/operativo', acceso: GESTION, descripcion: 'Stock bajo, ventas y devoluciones recientes (sin costos)' },
  { metodo: 'GET', ruta: '/api/reportes/ejecutivo', acceso: DUENA, descripcion: 'Dashboard ejecutivo con costos, ganancias y valor del inventario' },
  { metodo: 'GET', ruta: '/api/auditoria', acceso: GESTION, descripcion: 'Historial de auditoría' },
  { metodo: 'GET', ruta: '/api/configuracion/sistema', acceso: GESTION, descripcion: 'Ver la configuración general' },
  { metodo: 'PUT', ruta: '/api/configuracion/sistema', acceso: DUENA, descripcion: 'Cambiar la configuración general' }
];

// Convierte '/api/productos/:id' en una expresión regular que reconoce '/api/productos/5'.
function compilar(ruta) {
  const patron = ruta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\?:[a-z_]+/gi, '[^/]+');
  return new RegExp(`^${patron}$`);
}

const REGLAS_COMPILADAS = PERMISOS.map((regla) => ({ ...regla, patron: compilar(regla.ruta) }));

// Busca la regla para un método y una ruta. Devuelve null si no existe.
export function buscarRegla(metodo, ruta) {
  const metodoReal = metodo === 'HEAD' ? 'GET' : metodo;
  const rutaLimpia = ruta.length > 1 ? ruta.replace(/\/+$/, '') : ruta;
  return REGLAS_COMPILADAS.find((regla) => regla.metodo === metodoReal && regla.patron.test(rutaLimpia)) ?? null;
}
