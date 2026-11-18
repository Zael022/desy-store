# Matriz de permisos

Generada automáticamente con `npm run matriz` desde `backend/src/config/permisos.js`, que es la MISMA lista que usa el middleware `autorizar` en cada petición.

- **Sí**: el rol puede usar la ruta. **—**: el backend responde **403** (con sesión) o **401** (sin sesión).
- **Público**: no necesita sesión (igual pasa por los límites de peticiones y, si cambia datos, por CSRF).
- **Desafío MFA**: solo con la cookie temporal que se obtiene al pasar la contraseña (5 minutos). No da acceso a nada más.
- Una ruta que no esté aquí responde **404** aunque exista código para ella.
- Además de esta tabla hay reglas por dato: un proveedor solo ve lo suyo, un cliente solo sus compras, el rol ventas solo sus ventas, y el costo unitario solo lo ve la dueña (ver la columna "Restricción").

| Método | Ruta | Cliente | Proveedor | Ventas | Administrador | Dueña | Descripción | Restricción |
|---|---|:-:|:-:|:-:|:-:|:-:|---|---|
| GET | `/api/salud` | Público | Público | Público | Público | Público | Comprobar que la API y MySQL responden |  |
| GET | `/api/configuracion` | Público | Público | Público | Público | Público | Stock máximo y umbral de "pocas unidades" |  |
| GET | `/api/fotos/:archivo` | Público | Público | Público | Público | Público | Ver la foto de un producto (imagen WebP) |  |
| GET | `/api/auth/csrf` | Público | Público | Público | Público | Público | Obtener el token CSRF |  |
| POST | `/api/auth/registro` | Público | Público | Público | Público | Público | Registro de clientes (siempre rol cliente) |  |
| POST | `/api/auth/verificar-correo` | Público | Público | Público | Público | Público | Verificar el correo con el código |  |
| POST | `/api/auth/verificar-correo/reenviar` | Público | Público | Público | Público | Público | Pedir otro código de verificación de correo |  |
| POST | `/api/auth/login` | Público | Público | Público | Público | Público | Paso 1: correo y contraseña (crea el desafío MFA) |  |
| GET | `/api/auth/mfa/canales` | Desafío MFA | Desafío MFA | Desafío MFA | Desafío MFA | Desafío MFA | Canales verificados para recibir el código |  |
| POST | `/api/auth/mfa/enviar` | Desafío MFA | Desafío MFA | Desafío MFA | Desafío MFA | Desafío MFA | Paso 2: enviar el código por correo o SMS |  |
| POST | `/api/auth/mfa/verificar` | Desafío MFA | Desafío MFA | Desafío MFA | Desafío MFA | Desafío MFA | Paso 3: verificar el código y crear la sesión |  |
| POST | `/api/auth/logout` | Público | Público | Público | Público | Público | Cerrar sesión (revoca la sesión en el servidor) |  |
| GET | `/api/auth/sesion` | Sí | Sí | Sí | Sí | Sí | Usuario de la sesión actual |  |
| POST | `/api/auth/recuperar` | Público | Público | Público | Público | Público | Pedir enlace para restablecer la contraseña |  |
| POST | `/api/auth/restablecer` | Público | Público | Público | Público | Público | Restablecer la contraseña con el enlace |  |
| POST | `/api/auth/invitacion/validar` | Público | Público | Público | Público | Público | Revisar un enlace de invitación |  |
| POST | `/api/auth/invitacion/aceptar` | Público | Público | Público | Público | Público | Definir la contraseña de una cuenta invitada |  |
| GET | `/api/perfil` | Sí | Sí | Sí | Sí | Sí | Ver el perfil y los canales verificados | Solo el propio usuario |
| PUT | `/api/perfil/datos` | Sí | — | — | — | — | Editar nombre y dirección del cliente | Solo el propio cliente |
| PUT | `/api/perfil/contrasena` | Sí | Sí | Sí | Sí | Sí | Cambiar la contraseña (pide la actual) | Solo el propio usuario |
| POST | `/api/perfil/correo` | Sí | Sí | Sí | Sí | Sí | Pedir cambio de correo (código al correo nuevo) | Solo el propio usuario |
| POST | `/api/perfil/correo/confirmar` | Sí | Sí | Sí | Sí | Sí | Confirmar el correo nuevo con el código | Solo el propio usuario |
| POST | `/api/perfil/telefono` | Sí | Sí | Sí | Sí | Sí | Pedir verificación de teléfono (código por SMS) | Solo el propio usuario |
| POST | `/api/perfil/telefono/confirmar` | Sí | Sí | Sí | Sí | Sí | Confirmar el teléfono con el código | Solo el propio usuario |
| GET | `/api/perfil/sesiones` | Sí | Sí | Sí | Sí | Sí | Ver las sesiones abiertas | Solo las propias |
| POST | `/api/perfil/sesiones/cerrar-otras` | Sí | Sí | Sí | Sí | Sí | Cerrar las demás sesiones | Solo las propias |
| GET | `/api/catalogo` | Público | Público | Público | Público | Público | Catálogo con disponibilidad (sin stock exacto) |  |
| GET | `/api/catalogo/filtros` | Público | Público | Público | Público | Público | Categorías (con subcategorías), materiales y mensaje del catálogo |  |
| GET | `/api/catalogo/:id` | Público | Público | Público | Público | Público | Detalle de un producto del catálogo (con sus fotos) |  |
| GET | `/api/mis-compras` | Sí | — | — | — | — | Historial de compras del cliente | Solo ventas asociadas a su cuenta (desde la sesión) |
| GET | `/api/mis-compras/:id` | Sí | — | — | — | — | Detalle de una compra propia | Otra compra -> 404 |
| GET | `/api/mis-pedidos` | Sí | — | — | — | — | Pedidos del cliente | Solo los suyos (cliente tomado de la sesión) |
| POST | `/api/mis-pedidos` | Sí | — | — | — | — | Hacer un pedido: aparta las unidades hasta que la tienda responda (transacción + idempotencia) | Máximo 3 pedidos en curso, 20 productos y 10 unidades por producto |
| GET | `/api/mis-pedidos/:id` | Sí | — | — | — | — | Detalle de un pedido propio | Otro pedido -> 404 |
| PATCH | `/api/mis-pedidos/:id/cancelar` | Sí | — | — | — | — | Cancelar un pedido propio pendiente o confirmado (libera las unidades) | Otro pedido -> 404 |
| GET | `/api/portal-proveedor/productos` | — | Sí | — | — | — | Productos de su proveedor | Proveedor tomado de la sesión |
| GET | `/api/portal-proveedor/datos` | — | Sí | — | — | — | Ver sus datos de contacto | Proveedor tomado de la sesión |
| PUT | `/api/portal-proveedor/datos` | — | Sí | — | — | — | Actualizar sus datos de contacto | Proveedor tomado de la sesión |
| GET | `/api/portal-proveedor/solicitudes` | — | Sí | — | — | — | Solicitudes de abastecimiento dirigidas a él | Proveedor tomado de la sesión |
| GET | `/api/portal-proveedor/solicitudes/:id` | — | Sí | — | — | — | Detalle de una solicitud suya | De otro proveedor -> 404 |
| PATCH | `/api/portal-proveedor/solicitudes/:id/respuesta` | — | Sí | — | — | — | Aceptar o rechazar una solicitud pendiente | De otro proveedor -> 404 |
| GET | `/api/punto-venta/productos` | — | — | Sí | Sí | Sí | Buscar productos con precio y stock |  |
| GET | `/api/punto-venta/clientes` | — | — | Sí | Sí | Sí | Buscar clientes registrados |  |
| POST | `/api/ventas` | — | — | Sí | Sí | Sí | Confirmar una venta (transacción + idempotencia) | Vendedor y empleado tomados de la sesión |
| GET | `/api/ventas` | — | — | Sí | Sí | Sí | Listar ventas | Ventas: solo las propias. Administrador y dueña: todas |
| GET | `/api/ventas/:id` | — | — | Sí | Sí | Sí | Detalle de una venta | Ventas: venta ajena -> 404 |
| GET | `/api/pedidos` | — | — | Sí | Sí | Sí | Bandeja de pedidos de clientes (pendientes, confirmados, activos, historial) |  |
| GET | `/api/pedidos/resumen` | — | — | Sí | Sí | Sí | Cuántos pedidos esperan confirmación o entrega |  |
| GET | `/api/pedidos/:id` | — | — | Sí | Sí | Sí | Detalle de un pedido |  |
| PATCH | `/api/pedidos/:id/confirmar` | — | — | Sí | Sí | Sí | Confirmar un pedido pendiente (queda listo para recoger; aviso por correo) |  |
| PATCH | `/api/pedidos/:id/rechazar` | — | — | Sí | Sí | Sí | Rechazar un pedido pendiente o confirmado, con motivo (libera las unidades) |  |
| PATCH | `/api/pedidos/:id/entregar` | — | — | Sí | Sí | Sí | Entregar y cobrar un pedido confirmado: registra la venta | Empleado tomado de la sesión; se cobra el precio del pedido |
| POST | `/api/devoluciones` | — | — | Sí | Sí | Sí | Registrar una devolución | Ventas: solo de sus ventas |
| GET | `/api/devoluciones` | — | — | Sí | Sí | Sí | Listar devoluciones | Ventas: solo de sus ventas |
| GET | `/api/categorias` | — | — | — | Sí | Sí | Listar categorías |  |
| GET | `/api/categorias/:id` | — | — | — | Sí | Sí | Ver un registro de categorías |  |
| POST | `/api/categorias` | — | — | — | Sí | Sí | Crear en categorías |  |
| PUT | `/api/categorias/:id` | — | — | — | Sí | Sí | Editar en categorías |  |
| DELETE | `/api/categorias/:id` | — | — | — | Sí | Sí | Eliminar en categorías |  |
| GET | `/api/proveedores` | — | — | — | Sí | Sí | Listar proveedores |  |
| GET | `/api/proveedores/:id` | — | — | — | Sí | Sí | Ver un registro de proveedores |  |
| POST | `/api/proveedores` | — | — | — | Sí | Sí | Crear en proveedores |  |
| PUT | `/api/proveedores/:id` | — | — | — | Sí | Sí | Editar en proveedores |  |
| DELETE | `/api/proveedores/:id` | — | — | — | Sí | Sí | Eliminar en proveedores |  |
| GET | `/api/materiales` | — | — | — | Sí | Sí | Listar materiales |  |
| GET | `/api/materiales/:id` | — | — | — | Sí | Sí | Ver un registro de materiales |  |
| POST | `/api/materiales` | — | — | — | Sí | Sí | Crear en materiales |  |
| PUT | `/api/materiales/:id` | — | — | — | Sí | Sí | Editar en materiales |  |
| DELETE | `/api/materiales/:id` | — | — | — | Sí | Sí | Eliminar en materiales |  |
| GET | `/api/empleados` | — | — | — | Sí | Sí | Listar empleados |  |
| GET | `/api/empleados/:id` | — | — | — | Sí | Sí | Ver un registro de empleados |  |
| POST | `/api/empleados` | — | — | — | Sí | Sí | Crear en empleados |  |
| PUT | `/api/empleados/:id` | — | — | — | Sí | Sí | Editar en empleados |  |
| DELETE | `/api/empleados/:id` | — | — | — | Sí | Sí | Eliminar en empleados |  |
| GET | `/api/productos` | — | — | — | Sí | Sí | Listar productos | El costo unitario solo lo ve y lo cambia la dueña |
| GET | `/api/productos/:id` | — | — | — | Sí | Sí | Ver un registro de productos | El costo unitario solo lo ve y lo cambia la dueña |
| POST | `/api/productos` | — | — | — | Sí | Sí | Crear en productos | El costo unitario solo lo ve y lo cambia la dueña |
| PUT | `/api/productos/:id` | — | — | — | Sí | Sí | Editar en productos | El costo unitario solo lo ve y lo cambia la dueña |
| DELETE | `/api/productos/:id` | — | — | — | Sí | Sí | Eliminar en productos | El costo unitario solo lo ve y lo cambia la dueña |
| GET | `/api/productos/:id/fotos` | — | — | — | Sí | Sí | Listar las fotos de un producto |  |
| POST | `/api/productos/:id/fotos` | — | — | — | Sí | Sí | Subir una foto (JPG, PNG o WebP, máx. 5 MB y 8 por producto; puede marcarse como foto con medidas) | Se revisa y convierte a WebP sin datos ocultos (GPS) |
| PATCH | `/api/productos/:id/fotos/:idFoto/principal` | — | — | — | Sí | Sí | Elegir la foto principal | Una foto con medidas no puede ser la principal (409) |
| PATCH | `/api/productos/:id/fotos/:idFoto/medidas` | — | — | — | Sí | Sí | Marcar o desmarcar una foto con medidas | Las fotos con medidas van siempre al final |
| DELETE | `/api/productos/:id/fotos/:idFoto` | — | — | — | Sí | Sí | Borrar una foto |  |
| GET | `/api/movimientos` | — | — | — | Sí | Sí | Listar movimientos |  |
| GET | `/api/movimientos/:id` | — | — | — | Sí | Sí | Ver un registro de movimientos |  |
| POST | `/api/movimientos` | — | — | — | Sí | Sí | Crear en movimientos |  |
| PUT | `/api/movimientos/:id` | — | — | — | Sí | Sí | Editar en movimientos | Los movimientos de ventas, devoluciones o abastecimiento no se editan ni borran |
| DELETE | `/api/movimientos/:id` | — | — | — | Sí | Sí | Eliminar en movimientos | Los movimientos de ventas, devoluciones o abastecimiento no se editan ni borran |
| GET | `/api/abastecimiento` | — | — | — | Sí | Sí | Listar solicitudes de abastecimiento |  |
| GET | `/api/abastecimiento/:id` | — | — | — | Sí | Sí | Detalle de una solicitud |  |
| POST | `/api/abastecimiento` | — | — | — | Sí | Sí | Crear una solicitud a un proveedor |  |
| PATCH | `/api/abastecimiento/:id/recibir` | — | — | — | Sí | Sí | Marcar como recibida (genera entradas) |  |
| PATCH | `/api/abastecimiento/:id/cancelar` | — | — | — | Sí | Sí | Cancelar una solicitud pendiente o aceptada |  |
| GET | `/api/usuarios` | — | — | — | Sí | Sí | Listar cuentas |  |
| POST | `/api/usuarios/invitaciones` | — | — | — | Sí | Sí | Crear una cuenta interna o de proveedor por invitación | Administrador: solo ventas y proveedor. Dueña: cualquier rol interno o proveedor |
| POST | `/api/usuarios/:id/invitacion` | — | — | — | Sí | Sí | Reenviar la invitación de una cuenta sin contraseña | Misma regla de roles que al crear |
| PATCH | `/api/usuarios/:id/correo` | — | — | — | Sí | Sí | Corregir el correo de una cuenta con invitación pendiente | Misma regla de roles que al crear. Solo cuentas sin contraseña (las activas lo cambian desde su perfil con código) |
| PATCH | `/api/usuarios/:id/estado` | — | — | — | Sí | Sí | Activar o desactivar una cuenta | Administrador: solo ventas y proveedor. Nadie se desactiva a sí mismo |
| PATCH | `/api/usuarios/:id/rol` | — | — | — | — | Sí | Cambiar el rol interno de una cuenta | Solo roles internos. La única dueña activa no puede quitarse el rol |
| GET | `/api/reportes/operativo` | — | — | — | Sí | Sí | Stock bajo, ventas y devoluciones recientes (sin costos) |  |
| GET | `/api/reportes/ejecutivo` | — | — | — | — | Sí | Dashboard ejecutivo con costos, ganancias y valor del inventario |  |
| GET | `/api/auditoria` | — | — | — | Sí | Sí | Historial de auditoría |  |
| GET | `/api/configuracion/sistema` | — | — | — | Sí | Sí | Ver la configuración general |  |
| PUT | `/api/configuracion/sistema` | — | — | — | — | Sí | Cambiar la configuración general |  |

Total: 105 rutas.
