# Endpoints de la API

Base: `http://localhost:3000/api` (en desarrollo el frontend usa `/api` a través del proxy de Vite).

Reglas comunes:

- Las respuestas son JSON. Los errores tienen la forma `{ "message": "texto claro" }`.
- POST, PUT, PATCH y DELETE necesitan la cabecera `X-CSRF-Token` (se obtiene con `GET /api/auth/csrf`); sin ella: **403**.
- Sin sesión: **401**. Con sesión pero rol sin permiso: **403**. Ruta que no está en la matriz: **404**.
- Las cookies (`desy_sesion`, `desy_mfa`, `desy_csrf`) son HttpOnly y SameSite=Lax; el navegador debe enviarlas (`credentials: "include"`).
- Ninguna respuesta incluye hashes, códigos, tokens de sesión ni secretos.

## /api/salud

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/salud` | Público | Comprobar que la API y MySQL responden | — | 200 |

## /api/fotos

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/fotos/:archivo` | Público | Ver la foto de un producto (imagen WebP, se guarda un día en caché) | — | 200 `image/webp` · 404 nombre raro o foto que no existe |

## /api/configuracion

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/configuracion` | Público | Stock máximo y umbral de "pocas unidades" | — | 200 |
| GET | `/api/configuracion/sistema` | Administrador, Dueña | Ver la configuración general | — | 200 · 401 · 403 |
| PUT | `/api/configuracion/sistema` | Dueña | Cambiar la configuración general (también los plazos de los pedidos: `horas_pedido_pendiente` 1–720 y `dias_pedido_confirmado` 1–60) | `{ "umbral_pocas_unidades": 6, "proveedor_ve_stock": false, "mensaje_catalogo": "Hola", "horas_pedido_pendiente": 48 }` | 200 · 400 valor fuera de rango u opción desconocida |

## /api/auth

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/auth/csrf` | Público | Obtener el token CSRF | — | 200 |
| POST | `/api/auth/registro` | Público | Registro de clientes (siempre rol cliente) | `{ "nombre": "Lucía Mora", "correo": "lucia@correo.com", "contrasena": "********", "telefono": "+50688887777" }` | 201 mismo mensaje exista o no el correo · 400 datos inválidos · 429 límite · 503 correo no configurado o falló el envío |
| POST | `/api/auth/verificar-correo` | Público | Verificar el correo con el código | `{ "correo": "lucia@correo.com", "codigo": "123456" }` | 200 verificado · 400 código incorrecto/vencido/sin código vigente · 429 quinto intento fallido |
| POST | `/api/auth/verificar-correo/reenviar` | Público | Pedir otro código de verificación de correo | `{ "correo": "lucia@correo.com" }` | 200 genérico · 429 esperar 60 s o máximo por hora · 503 envío falló |
| POST | `/api/auth/login` | Público | Paso 1: correo y contraseña (crea el desafío MFA) | `{ "correo": "lucia@correo.com", "contrasena": "********" }` | 200 `{ estado: "mfa", canales: [{ canal, destino enmascarado }] }` + cookie desy_mfa (5 min) o `{ estado: "verificar_correo" }` · 401 "Correo o contraseña incorrectos." · 403 cuenta desactivada · 429 bloqueo de 15 min |
| GET | `/api/auth/mfa/canales` | Desafío MFA (después de la contraseña) | Canales verificados para recibir el código | — | 200 `{ canales }` · 401 desafío vencido |
| POST | `/api/auth/mfa/enviar` | Desafío MFA (después de la contraseña) | Paso 2: enviar el código por correo o SMS | `{ "canal": "correo" }  o  { "canal": "sms" }` | 200 `{ destino, minutos: 5, espera_reenvio: 60 }` · 400 canal no verificado · 401 sin desafío · 429 esperar 60 s / máximo por hora · 503 envío falló |
| POST | `/api/auth/mfa/verificar` | Desafío MFA (después de la contraseña) | Paso 3: verificar el código y crear la sesión | `{ "codigo": "123456" }` | 200 `{ usuario, destino, csrfToken }` + cookie desy_sesion · 400 incorrecto o vencido · 401 sin desafío · 429 quinto intento (código anulado) |
| POST | `/api/auth/logout` | Público | Cerrar sesión (revoca la sesión en el servidor) | — | 200 (revoca la sesión en el servidor y borra las cookies) |
| GET | `/api/auth/sesion` | Cliente, Proveedor, Ventas, Administrador, Dueña | Usuario de la sesión actual | — | 200 `{ usuario, destino }` · 401 |
| POST | `/api/auth/recuperar` | Público | Pedir enlace para restablecer la contraseña | `{ "correo": "lucia@correo.com" }` | 200 mismo mensaje exista o no · 429 · 503 correo no configurado |
| POST | `/api/auth/restablecer` | Público | Restablecer la contraseña con el enlace | `{ "token": "token-del-enlace", "contrasena": "********" }` | 200 (cierra todas las sesiones) · 400 enlace inválido/vencido/usado |
| POST | `/api/auth/invitacion/validar` | Público | Revisar un enlace de invitación | `{ "token": "token-del-enlace" }` | 200 `{ correo, nombre, rol, nombre_rol }` · 400 |
| POST | `/api/auth/invitacion/aceptar` | Público | Definir la contraseña de una cuenta invitada | `{ "token": "token-del-enlace", "contrasena": "********" }` | 200 cuenta activada (correo verificado) · 400 |

## /api/perfil

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/perfil` | Cliente, Proveedor, Ventas, Administrador, Dueña | Ver el perfil y los canales verificados. Solo el propio usuario | — | 200 · 401 · 403 |
| PUT | `/api/perfil/datos` | Cliente | Editar nombre y dirección del cliente. Solo el propio cliente | `{ "nombre": "Lucía Mora", "direccion": "Puntarenas" }` | 200 · 400 |
| PUT | `/api/perfil/contrasena` | Cliente, Proveedor, Ventas, Administrador, Dueña | Cambiar la contraseña (pide la actual). Solo el propio usuario | `{ "actual": "********", "nueva": "********" }` | 200 (cierra las otras sesiones) · 400 actual incorrecta |
| POST | `/api/perfil/correo` | Cliente, Proveedor, Ventas, Administrador, Dueña | Pedir cambio de correo (código al correo nuevo). Solo el propio usuario | `{ "correo_nuevo": "nuevo@correo.com", "contrasena": "********" }` | 200 código enviado al correo nuevo · 400 · 409 correo en uso · 503 |
| POST | `/api/perfil/correo/confirmar` | Cliente, Proveedor, Ventas, Administrador, Dueña | Confirmar el correo nuevo con el código. Solo el propio usuario | `{ "codigo": "123456" }` | 200 · 400 · 429 |
| POST | `/api/perfil/telefono` | Cliente, Proveedor, Ventas, Administrador, Dueña | Pedir verificación de teléfono (código por SMS). Solo el propio usuario | `{ "telefono": "+50688887777" }` | 200 SMS enviado · 400 formato · 429 · 503 Twilio (número no verificado en cuenta de prueba) |
| POST | `/api/perfil/telefono/confirmar` | Cliente, Proveedor, Ventas, Administrador, Dueña | Confirmar el teléfono con el código. Solo el propio usuario | `{ "codigo": "123456" }` | 200 teléfono verificado · 400 · 429 |
| GET | `/api/perfil/sesiones` | Cliente, Proveedor, Ventas, Administrador, Dueña | Ver las sesiones abiertas. Solo las propias | — | 200 · 401 · 403 |
| POST | `/api/perfil/sesiones/cerrar-otras` | Cliente, Proveedor, Ventas, Administrador, Dueña | Cerrar las demás sesiones. Solo las propias | — | 200 |

## /api/catalogo

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/catalogo` | Público | Catálogo con disponibilidad (sin stock exacto), categoría principal y `foto_principal` | — | 200 |
| GET | `/api/catalogo/filtros` | Público | Categorías (con `id_categoria_padre`), materiales y mensaje del catálogo | — | 200 |
| GET | `/api/catalogo/:id` | Público | Detalle de un producto del catálogo con `fotos: ["archivo.webp", ...]` (la primera es la principal; las de medidas van al final) y `fotos_medidas` | — | 200 · 404 |

## /api/mis-compras

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/mis-compras` | Cliente | Historial de compras del cliente. Solo ventas asociadas a su cuenta (desde la sesión) | — | 200 · 401 · 403 |
| GET | `/api/mis-compras/:id` | Cliente | Detalle de una compra propia. Otra compra -> 404 | — | 200 · 401 · 403 |

## /api/mis-pedidos

El cliente sale de la sesión (aunque el cuerpo traiga `id_cliente`, se ignora). Cada pedido trae su `detalle` (con la foto principal de cada producto), `activo` y `vence_en`.

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/mis-pedidos` | Cliente | Sus pedidos (en curso e historial) | — | 200 |
| POST | `/api/mis-pedidos` | Cliente | Hacer un pedido: aparta las unidades (transacción + idempotencia) y le envía "Recibimos su pedido" | `{ "clave_idempotencia": "uuid", "nota": "Paso el viernes", "items": [{ "id_producto": 14, "cantidad": 1 }] }` | 201 · 200 `repetido: true` (misma clave) · 400 sin clave, sin productos, repetido, cantidad fuera de 1–10, más de 20 productos · 409 no alcanza lo disponible o ya tiene 3 pedidos en curso |
| GET | `/api/mis-pedidos/:id` | Cliente | Un pedido suyo | — | 200 · 404 pedido de otro cliente |
| PATCH | `/api/mis-pedidos/:id/cancelar` | Cliente | Cancelar un pedido pendiente o confirmado (libera las unidades) | — | 200 · 404 · 409 ya entregado, rechazado o vencido |

## /api/pedidos

Bandeja de la tienda. Antes de responder se vencen los pedidos atrasados (y se avisa a sus clientes).

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/pedidos?filtro=pendientes` | Ventas, Administrador, Dueña | Pedidos por filtro: `pendientes`, `confirmados`, `activos` (por defecto), `historial` o `todos`; con datos de contacto del cliente | — | 200 · 400 filtro desconocido |
| GET | `/api/pedidos/resumen` | Ventas, Administrador, Dueña | `{ pendientes, confirmados }` para el aviso del menú | — | 200 |
| GET | `/api/pedidos/:id` | Ventas, Administrador, Dueña | Detalle de un pedido | — | 200 · 404 |
| PATCH | `/api/pedidos/:id/confirmar` | Ventas, Administrador, Dueña | Confirmar un pendiente: queda listo para recoger, el plazo pasa a `dias_pedido_confirmado` y se avisa por correo | — | 200 `{ ..., avisado }` · 404 · 409 ya confirmado, vencido u otro estado |
| PATCH | `/api/pedidos/:id/rechazar` | Ventas, Administrador, Dueña | Rechazar un pendiente o cancelar un confirmado, con motivo (libera las unidades; aviso por correo) | `{ "motivo": "El producto se dañó" }` | 200 · 400 sin motivo · 404 · 409 |
| PATCH | `/api/pedidos/:id/entregar` | Ventas, Administrador, Dueña | Entregar y cobrar un confirmado: registra una venta a nombre del cliente con el precio del pedido (empleado de la sesión) | — | 200 `{ ..., id_venta, message }` · 404 · 409 no está confirmado o venció |

Además, `GET /api/catalogo` calcula la disponibilidad con lo **disponible** (stock − apartado), `GET /api/punto-venta/productos` devuelve `stock` (disponible), `stock_fisico` y `apartado`, y `GET /api/productos` incluye `apartado`.

## /api/portal-proveedor

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/portal-proveedor/productos` | Proveedor | Productos de su proveedor. Proveedor tomado de la sesión | — | 200 · 401 · 403 |
| GET | `/api/portal-proveedor/datos` | Proveedor | Ver sus datos de contacto. Proveedor tomado de la sesión | — | 200 · 401 · 403 |
| PUT | `/api/portal-proveedor/datos` | Proveedor | Actualizar sus datos de contacto. Proveedor tomado de la sesión | `{ "contacto": "Laura", "telefono": "8800-0001", "correo": "x@y.com", "direccion": "Puntarenas" }` | 200 · 400 · 409 correo repetido |
| GET | `/api/portal-proveedor/solicitudes` | Proveedor | Solicitudes de abastecimiento dirigidas a él. Proveedor tomado de la sesión | — | 200 · 401 · 403 |
| GET | `/api/portal-proveedor/solicitudes/:id` | Proveedor | Detalle de una solicitud suya. De otro proveedor -> 404 | — | 200 · 401 · 403 |
| PATCH | `/api/portal-proveedor/solicitudes/:id/respuesta` | Proveedor | Aceptar o rechazar una solicitud pendiente. De otro proveedor -> 404 | `{ "decision": "aceptada", "comentario": "Sale el lunes" }  (rechazada exige comentario)` | 200 · 400 · 404 solicitud de otro proveedor · 409 ya respondida |

## /api/punto-venta

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/punto-venta/productos` | Ventas, Administrador, Dueña | Buscar productos con precio y stock | `?buscar=collar` | 200 con stock y disponibilidad (sin costo) |
| GET | `/api/punto-venta/clientes` | Ventas, Administrador, Dueña | Buscar clientes registrados | `?buscar=cam` (mínimo 2 letras) | 200 |

## /api/ventas

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| POST | `/api/ventas` | Ventas, Administrador, Dueña | Confirmar una venta (transacción + idempotencia). Vendedor y empleado tomados de la sesión | `{ "clave_idempotencia": "8c1f…-uuid", "id_cliente": 3, "nota": null, "items": [{ "id_producto": 1, "cantidad": 2 }] }` | 201 venta nueva · 200 `repetida: true` (misma clave) · 400 · 409 stock insuficiente |
| GET | `/api/ventas` | Ventas, Administrador, Dueña | Listar ventas. Ventas: solo las propias. Administrador y dueña: todas | `?desde=2026-11-01&hasta=2026-11-30` (opcional) | 200 (rol ventas: solo las suyas) |
| GET | `/api/ventas/:id` | Ventas, Administrador, Dueña | Detalle de una venta. Ventas: venta ajena -> 404 | — | 200 (costo solo para la dueña) · 404 inexistente o de otro vendedor |

## /api/devoluciones

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| POST | `/api/devoluciones` | Ventas, Administrador, Dueña | Registrar una devolución. Ventas: solo de sus ventas | `{ "id_venta": 5, "motivo": "Broche flojo", "items": [{ "id_detalle_venta": 9, "cantidad": 1 }] }` | 201 · 400 · 404 venta inexistente o ajena · 409 más de lo vendido o pasaría de 67 |
| GET | `/api/devoluciones` | Ventas, Administrador, Dueña | Listar devoluciones. Ventas: solo de sus ventas | — | 200 · 401 · 403 |

## /api/categorias

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/categorias` | Administrador, Dueña | Listar categorías | — | 200 · 401 · 403 |
| GET | `/api/categorias/:id` | Administrador, Dueña | Ver un registro de categorías | — | 200 · 401 · 403 |
| POST | `/api/categorias` | Administrador, Dueña | Crear en categorías (con `id_categoria_padre` es una subcategoría) | `{ "nombre": "Peluches", "descripcion": null, "id_categoria_padre": 6 }` | 201 · 400 principal inexistente o que ya es subcategoría · 409 duplicado |
| PUT | `/api/categorias/:id` | Administrador, Dueña | Editar en categorías (sin `id_categoria_padre` se conserva el que tenía; `null` la vuelve principal) | `{ "nombre": "Peluches", "descripcion": null, "id_categoria_padre": 6 }` | 200 · 400 dentro de sí misma o tiene subcategorías · 404 · 409 |
| DELETE | `/api/categorias/:id` | Administrador, Dueña | Eliminar en categorías | — | 200 `{ message, id }` · 404 · 409 tiene subcategorías o productos |

## /api/proveedores

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/proveedores` | Administrador, Dueña | Listar proveedores | — | 200 · 401 · 403 |
| GET | `/api/proveedores/:id` | Administrador, Dueña | Ver un registro de proveedores | — | 200 · 401 · 403 |
| POST | `/api/proveedores` | Administrador, Dueña | Crear en proveedores | `{ "nombre": "…", "contacto": null, "telefono": "2661-0000", "correo": null, "direccion": null }` | 201 · 400 · 409 duplicado |
| PUT | `/api/proveedores/:id` | Administrador, Dueña | Editar en proveedores | `{ "nombre": "…", "contacto": null, "telefono": "2661-0000", "correo": null, "direccion": null }` | 200 · 400 · 404 · 409 |
| DELETE | `/api/proveedores/:id` | Administrador, Dueña | Eliminar en proveedores | — | 200 `{ message, id }` · 404 · 409 tiene registros relacionados |

## /api/materiales

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/materiales` | Administrador, Dueña | Listar materiales | — | 200 · 401 · 403 |
| GET | `/api/materiales/:id` | Administrador, Dueña | Ver un registro de materiales | — | 200 · 401 · 403 |
| POST | `/api/materiales` | Administrador, Dueña | Crear en materiales | `{ "nombre": "Plata 925", "es_hipoalergenico": true, "descripcion": null }` | 201 · 400 · 409 duplicado |
| PUT | `/api/materiales/:id` | Administrador, Dueña | Editar en materiales | `{ "nombre": "Plata 925", "es_hipoalergenico": true, "descripcion": null }` | 200 · 400 · 404 · 409 |
| DELETE | `/api/materiales/:id` | Administrador, Dueña | Eliminar en materiales | — | 200 `{ message, id }` · 404 · 409 tiene registros relacionados |

## /api/empleados

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/empleados` | Administrador, Dueña | Listar empleados | — | 200 · 401 · 403 |
| GET | `/api/empleados/:id` | Administrador, Dueña | Ver un registro de empleados | — | 200 · 401 · 403 |
| POST | `/api/empleados` | Administrador, Dueña | Crear en empleados | `{ "nombre": "Ana", "puesto": "Vendedora", "telefono": null, "correo": "ana@correo.com" }` | 201 · 400 · 409 duplicado |
| PUT | `/api/empleados/:id` | Administrador, Dueña | Editar en empleados | `{ "nombre": "Ana", "puesto": "Vendedora", "telefono": null, "correo": "ana@correo.com" }` | 200 · 400 · 404 · 409 |
| DELETE | `/api/empleados/:id` | Administrador, Dueña | Eliminar en empleados | — | 200 `{ message, id }` · 404 · 409 tiene registros relacionados |

## /api/productos

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/productos` | Administrador, Dueña | Listar productos. El costo unitario solo lo ve y lo cambia la dueña | — | 200 · 401 · 403 |
| GET | `/api/productos/:id` | Administrador, Dueña | Ver un registro de productos. El costo unitario solo lo ve y lo cambia la dueña | — | 200 · 401 · 403 |
| POST | `/api/productos` | Administrador, Dueña | Crear en productos. El costo unitario solo lo ve y lo cambia la dueña | `{ "codigo": "ARE-010", "nombre": "…", "descripcion": null, "precio": 4500, "id_categoria": 1, "id_proveedor": 2, "id_material": 1, "costo_unitario": 2000 }  (costo_unitario solo la dueña)` | 201 · 400 · 409 duplicado · 403 admin enviando costo |
| PUT | `/api/productos/:id` | Administrador, Dueña | Editar en productos. El costo unitario solo lo ve y lo cambia la dueña | `{ "codigo": "ARE-010", "nombre": "…", "descripcion": null, "precio": 4500, "id_categoria": 1, "id_proveedor": 2, "id_material": 1, "costo_unitario": 2000 }  (costo_unitario solo la dueña)` | 200 · 400 · 404 · 409 |
| DELETE | `/api/productos/:id` | Administrador, Dueña | Eliminar en productos (también borra sus fotos). El costo unitario solo lo ve y lo cambia la dueña | — | 200 `{ message, id }` · 404 · 409 tiene registros relacionados |
| GET | `/api/productos/:id/fotos` | Administrador, Dueña | Listar las fotos de un producto (normales primero, medidas al final) | — | 200 `[{ id_foto, archivo, orden, es_de_medidas }]` · 404 |
| POST | `/api/productos/:id/fotos` | Administrador, Dueña | Subir UNA foto (formulario `multipart/form-data`, campo `foto`; opcional `es_de_medidas=true`). Se convierte a WebP sin datos GPS | archivo JPG, PNG o WebP de hasta 5 MB y 200 x 200 px como mínimo | 201 lista de fotos · 400 no es imagen, formato o tamaño · 404 · 409 ya tiene 8 · 413 pesa más de 5 MB |
| PATCH | `/api/productos/:id/fotos/:idFoto/principal` | Administrador, Dueña | Poner una foto de primera (principal) | — | 200 lista de fotos · 404 foto de otro producto · 409 es una foto con medidas |
| PATCH | `/api/productos/:id/fotos/:idFoto/medidas` | Administrador, Dueña | Marcar o desmarcar una foto con medidas (se mueve al final o vuelve con las normales) | `{ "es_de_medidas": true }` | 200 lista de fotos · 400 valor que no es true/false · 404 |
| DELETE | `/api/productos/:id/fotos/:idFoto` | Administrador, Dueña | Borrar una foto (base y archivo); las demás se vuelven a numerar | — | 200 lista de fotos · 404 |

`GET /api/productos` y `GET /api/productos/:id` incluyen además `foto_principal` (nunca una foto con medidas; `null` si no hay otra), `total_fotos`, `id_categoria_padre` y `nombre_categoria_padre`.

## /api/movimientos

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/movimientos` | Administrador, Dueña | Listar movimientos | — | 200 · 401 · 403 |
| GET | `/api/movimientos/:id` | Administrador, Dueña | Ver un registro de movimientos | — | 200 · 401 · 403 |
| POST | `/api/movimientos` | Administrador, Dueña | Crear en movimientos | `{ "id_producto": 1, "tipo": "entrada", "cantidad": 5, "fecha": "2026-11-05", "motivo": "Compra" }  (el empleado sale de la sesión)` | 201 · 400 · 409 duplicado o stock fuera de 0..67 |
| PUT | `/api/movimientos/:id` | Administrador, Dueña | Editar en movimientos. Los movimientos de ventas, devoluciones o abastecimiento no se editan ni borran | `{ "id_producto": 1, "tipo": "entrada", "cantidad": 5, "fecha": "2026-11-05", "motivo": "Compra" }  (el empleado sale de la sesión)` | 200 · 400 · 404 · 409 (también si pertenece a una venta/devolución/solicitud) |
| DELETE | `/api/movimientos/:id` | Administrador, Dueña | Eliminar en movimientos. Los movimientos de ventas, devoluciones o abastecimiento no se editan ni borran | — | 200 `{ message, id }` · 404 · 409 tiene registros relacionados o pertenece a una venta |

## /api/abastecimiento

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/abastecimiento` | Administrador, Dueña | Listar solicitudes de abastecimiento | — | 200 · 401 · 403 |
| GET | `/api/abastecimiento/:id` | Administrador, Dueña | Detalle de una solicitud | — | 200 · 401 · 403 |
| POST | `/api/abastecimiento` | Administrador, Dueña | Crear una solicitud a un proveedor | `{ "id_proveedor": 1, "nota": "Navidad", "items": [{ "id_producto": 3, "cantidad": 10 }] }` | 201 · 400 producto de otro proveedor |
| PATCH | `/api/abastecimiento/:id/recibir` | Administrador, Dueña | Marcar como recibida (genera entradas) | — | 200 (una entrada por producto) · 409 no aceptada o pasaría de 67 |
| PATCH | `/api/abastecimiento/:id/cancelar` | Administrador, Dueña | Cancelar una solicitud pendiente o aceptada | — | 200 · 409 ya recibida/rechazada |

## /api/usuarios

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/usuarios` | Administrador, Dueña | Listar cuentas | — | 200 · 401 · 403 |
| POST | `/api/usuarios/invitaciones` | Administrador, Dueña | Crear una cuenta interna o de proveedor por invitación. Administrador: solo ventas y proveedor. Dueña: cualquier rol interno o proveedor | `{ "rol": "ventas", "correo": "ana@correo.com", "id_empleado": 2 }  o  { "rol": "proveedor", "correo": "…", "id_proveedor": 1 }` | 201 invitación enviada · 400 · 403 rol no permitido · 409 ya tiene cuenta · 503 (no se crea) |
| POST | `/api/usuarios/:id/invitacion` | Administrador, Dueña | Reenviar la invitación de una cuenta sin contraseña. Misma regla de roles que al crear | — | 200 · 403 · 409 ya tiene contraseña |
| PATCH | `/api/usuarios/:id/correo` | Administrador, Dueña | Corregir el correo de una cuenta con invitación pendiente. Misma regla de roles que al crear. Solo cuentas sin contraseña (las activas lo cambian desde su perfil con código) | `{ "correo": "correcto@correo.com" }` | 200 (anula la invitación anterior; reenvíela) · 400 · 403 rol no permitido · 409 la cuenta ya está activa o el correo está en uso |
| PATCH | `/api/usuarios/:id/estado` | Administrador, Dueña | Activar o desactivar una cuenta. Administrador: solo ventas y proveedor. Nadie se desactiva a sí mismo | `{ "activo": false }` | 200 (desactivar cierra sus sesiones) · 400 propia cuenta · 403 |
| PATCH | `/api/usuarios/:id/rol` | Dueña | Cambiar el rol interno de una cuenta. Solo roles internos. La única dueña activa no puede quitarse el rol | `{ "rol": "administrador" }` | 200 · 400 no interna · 409 única dueña activa |

## /api/reportes

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/reportes/operativo` | Administrador, Dueña | Stock bajo, ventas y devoluciones recientes (sin costos) | `?desde=&hasta=` (por defecto últimos 30 días) | 200 sin dinero |
| GET | `/api/reportes/ejecutivo` | Dueña | Dashboard ejecutivo con costos, ganancias y valor del inventario | `?desde=&hasta=` | 200 ingresos, costos, ganancia (solo con costos), `ganancia_parcial`, valor de inventario · 400 rango |

## /api/auditoria

| Método | Ruta | Quién | Para qué | Cuerpo (ejemplo) | Respuestas |
|---|---|---|---|---|---|
| GET | `/api/auditoria` | Administrador, Dueña | Historial de auditoría | `?accion=login_exitoso&desde=&hasta=` | 200 `{ registros, acciones }` |
