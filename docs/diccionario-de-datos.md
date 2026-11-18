# Diccionario de datos

Base de datos: `inventario_bisuteria` (MySQL 8, `utf8mb4`, InnoDB). Esta lista se sacó de la base real después de `script.sql` + `npm run migrar`.

- **PK**: llave primaria. **FK**: llave foránea. **UK**: valor único.
- Todas las FK son `RESTRICT` (sin cascada).
- Textos sin espacios al inicio ni al final; un texto opcional vacío se guarda como `NULL`.
- Tablas 1 a 6: versión 1 (inventario). Tablas 7 a 21: versión 2 (cuentas, MFA, ventas, abastecimiento). La tabla 5b y la columna `categorias.id_categoria_padre` son de la migración 006 (fotos y subcategorías); las tablas 19b y 19c, de la migración 008 (pedidos de clientes): 24 tablas en total.

## 1. categorias

Tipo de producto (aretes, collares, crochet...). Puede tener subcategorías (Crochet > Peluches).

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_categoria | int unsigned | Sí | PK | AUTO_INCREMENT |
| nombre | varchar(60) | Sí | UK |  |
| descripcion | varchar(255) | No |  |  |
| id_categoria_padre | int unsigned | No | FK → categorias | NULL = categoría principal. Solo dos niveles (lo revisa el backend); no se borra una categoría que tiene subcategorías |

## 2. proveedores

Personas o empresas a las que se les compra mercadería. Una cuenta de proveedor apunta aquí (no repite sus datos).

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_proveedor | int unsigned | Sí | PK | AUTO_INCREMENT |
| nombre | varchar(100) | Sí | UK |  |
| contacto | varchar(100) | No |  |  |
| telefono | varchar(20) | Sí |  |  |
| correo | varchar(100) | No | UK |  |
| direccion | varchar(255) | No |  |  |

## 3. materiales

Material principal de cada producto.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_material | int unsigned | Sí | PK | AUTO_INCREMENT |
| nombre | varchar(60) | Sí | UK |  |
| es_hipoalergenico | tinyint(1) | Sí |  | Por defecto: 0 |
| descripcion | varchar(255) | No |  |  |

## 4. empleados

Personal de la tienda. Toda cuenta interna (ventas, administración, dueña) apunta a un empleado.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_empleado | int unsigned | Sí | PK | AUTO_INCREMENT |
| nombre | varchar(100) | Sí |  |  |
| puesto | varchar(60) | Sí |  |  |
| telefono | varchar(20) | No |  |  |
| correo | varchar(100) | Sí | UK |  |

## 5. productos

Catálogo e inventario. El stock solo cambia con movimientos.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_producto | int unsigned | Sí | PK | AUTO_INCREMENT |
| codigo | varchar(20) | Sí | UK |  |
| nombre | varchar(100) | Sí |  |  |
| descripcion | varchar(255) | No |  |  |
| precio | decimal(10,2) | Sí |  | ≥ 0 |
| costo_unitario | decimal(10,2) | No |  | Opcional (NULL = sin costo). Solo la dueña lo ve; ≥ 0 |
| stock | int | Sí |  | 0 a 67; solo cambia con movimientos |
| id_categoria | int unsigned | Sí | FK → categorias |  |
| id_proveedor | int unsigned | Sí | FK → proveedores |  |
| id_material | int unsigned | Sí | FK → materiales |  |

## 5b. producto_fotos

Fotos de cada producto. En la base solo se guarda el nombre del archivo; la imagen está en `backend/uploads/productos` y se ve en `GET /api/fotos/:archivo`.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_foto | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_producto | int unsigned | Sí | FK → productos | Índice (id_producto, orden) |
| archivo | varchar(100) | Sí | UK | WebP con nombre al azar (32 letras) o el de las fotos iniciales (`cro-pel-001-1.webp`) |
| orden | smallint unsigned | Sí |  | 1, 2, 3...: la de menor orden entre las fotos normales es la principal |
| es_de_medidas | tinyint(1) | Sí |  | Migración 007. 1 = foto con medidas: nunca es la principal, va siempre al final y no se usa en las tarjetas. Por defecto 0 |
| creada_en | datetime | Sí |  | Por defecto la fecha actual |

## 6. movimientos

Cada entrada o salida de mercadería. Si viene de una venta, devolución o abastecimiento, guarda el enlace y no se puede editar ni borrar a mano.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_movimiento | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_producto | int unsigned | Sí | FK → productos |  |
| id_empleado | int unsigned | Sí | FK → empleados |  |
| tipo | enum('entrada','salida') | Sí |  |  |
| cantidad | int | Sí |  | 1 a 67 |
| fecha | date | Sí |  |  |
| motivo | varchar(255) | No |  |  |
| id_venta | int unsigned | No | FK → ventas | Si la generó una venta |
| id_devolucion | int unsigned | No | FK → devoluciones | Si la generó una devolución |
| id_solicitud | int unsigned | No | FK → solicitudes_abastecimiento | Si la generó un abastecimiento recibido |

## 7. usuarios

Cuentas para entrar al sistema. Guarda solo el HASH de la contraseña (Argon2id).

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_usuario | int unsigned | Sí | PK | AUTO_INCREMENT |
| correo | varchar(100) | Sí | UK | Único; en minúsculas |
| hash_contrasena | varchar(255) | No |  | Argon2id (o bcrypt 12). NULL = invitación pendiente |
| rol | enum('cliente','proveedor','ventas','administrador','duena') | Sí |  | Un rol por cuenta |
| activo | tinyint(1) | Sí |  | Por defecto: 1 |
| correo_verificado | tinyint(1) | Sí |  | Por defecto: 0 |
| telefono | varchar(20) | No |  | Formato internacional +506... |
| telefono_verificado | tinyint(1) | Sí |  | Por defecto: 0 |
| intentos_fallidos | int | Sí |  | Se reinicia al acertar; a los 5 se bloquea |
| bloqueado_hasta | datetime | No |  | Bloqueo temporal de 15 min |
| id_empleado | int unsigned | No | UK, FK → empleados | Obligatorio para roles internos (CHECK) |
| id_proveedor | int unsigned | No | UK, FK → proveedores | Obligatorio para rol proveedor (CHECK) |
| creado_en | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |
| ultimo_acceso | datetime | No |  |  |

## 8. clientes

Datos del cliente registrado (uno por cuenta de cliente).

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_cliente | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_usuario | int unsigned | Sí | UK, FK → usuarios |  |
| nombre | varchar(100) | Sí |  |  |
| direccion | varchar(255) | No |  |  |
| creado_en | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |

## 9. desafios_mfa

"Desafío" temporal entre la contraseña correcta y el código MFA (5 minutos). Se guarda el hash del token de la cookie desy_mfa.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_desafio | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_usuario | int unsigned | Sí | FK → usuarios |  |
| hash_token | char(64) | Sí | UK |  |
| expira_en | datetime | Sí |  |  |
| usado | tinyint(1) | Sí |  | Por defecto: 0 |
| ip | varchar(45) | No |  |  |
| creado_en | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |

## 10. codigos_verificacion

Códigos de 6 dígitos (MFA y verificaciones). Solo se guarda el HMAC-SHA256, nunca el número.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_codigo | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_usuario | int unsigned | Sí | FK → usuarios |  |
| id_desafio | int unsigned | No | FK → desafios_mfa |  |
| proposito | enum('mfa','verificar_correo','verificar_telefono','cambio_correo') | Sí |  |  |
| canal | enum('correo','sms') | Sí |  |  |
| destino | varchar(100) | Sí |  | Correo o teléfono al que se envió |
| hash_codigo | char(64) | Sí |  | HMAC-SHA256 en hexadecimal (64) |
| expira_en | datetime | Sí |  |  |
| intentos | int | Sí |  | Máximo 5 |
| usado | tinyint(1) | Sí |  | Por defecto: 0 |
| anulado | tinyint(1) | Sí |  | 1 si se pidió otro o se agotaron los intentos |
| creado_en | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |

## 11. sesiones

Sesiones abiertas. La cookie lleva un token aleatorio; aquí se guarda solo su hash SHA-256.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_sesion | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_usuario | int unsigned | Sí | FK → usuarios |  |
| hash_token | char(64) | Sí | UK | SHA-256 del token de la cookie |
| creada_en | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |
| ultima_actividad | datetime | Sí |  | Se vence tras 30 min sin actividad |
| expira_absoluta | datetime | Sí |  | 8 horas después del inicio |
| revocada | tinyint(1) | Sí |  | Por defecto: 0 |
| ip | varchar(45) | No |  |  |
| agente | varchar(255) | No |  |  |

## 12. recuperacion_contrasena

Enlaces de un solo uso: recuperar contraseña (15 min) e invitaciones (48 h). Solo hash del token.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_recuperacion | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_usuario | int unsigned | Sí | FK → usuarios |  |
| proposito | enum('recuperar','invitacion') | Sí |  |  |
| hash_token | char(64) | Sí | UK |  |
| expira_en | datetime | Sí |  |  |
| usado | tinyint(1) | Sí |  | Por defecto: 0 |
| id_usuario_creador | int unsigned | No | FK → usuarios |  |
| creado_en | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |

## 13. auditoria

Registro de acciones sensibles: quién, qué, cuándo y desde qué IP. Nunca contraseñas ni códigos.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_auditoria | bigint unsigned | Sí | PK | AUTO_INCREMENT |
| id_usuario | int unsigned | No | FK → usuarios |  |
| accion | varchar(60) | Sí |  |  |
| detalle | varchar(500) | No |  |  |
| ip | varchar(45) | No |  |  |
| creado_en | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |

## 14. ventas

Venta confirmada en el punto de venta. No se edita ni se borra: se corrige con devoluciones.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_venta | int unsigned | Sí | PK | AUTO_INCREMENT |
| clave_idempotencia | char(36) | Sí | UK | UUID único enviado por el navegador (evita ventas duplicadas) |
| id_usuario | int unsigned | Sí | FK → usuarios |  |
| id_empleado | int unsigned | Sí | FK → empleados |  |
| id_cliente | int unsigned | No | FK → clientes |  |
| total | decimal(12,2) | Sí |  |  |
| nota | varchar(255) | No |  |  |
| fecha | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |

## 15. detalle_ventas

Productos de cada venta, con el precio y el costo que tenían al vender.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_detalle_venta | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_venta | int unsigned | Sí | FK → ventas |  |
| id_producto | int unsigned | Sí | FK → productos |  |
| cantidad | int | Sí |  |  |
| precio_unitario | decimal(10,2) | Sí |  | Precio al momento de vender |
| costo_unitario | decimal(10,2) | No |  | Costo al momento de vender (NULL si no había) |
| subtotal | decimal(12,2) | Sí |  |  |

## 16. devoluciones

Devolución de una venta (con motivo).

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_devolucion | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_venta | int unsigned | Sí | FK → ventas |  |
| id_usuario | int unsigned | Sí | FK → usuarios |  |
| id_empleado | int unsigned | Sí | FK → empleados |  |
| motivo | varchar(255) | Sí |  | Obligatorio |
| total | decimal(12,2) | Sí |  |  |
| fecha | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |

## 17. detalle_devoluciones

Qué líneas de la venta y cuántas unidades se devolvieron.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_detalle_devolucion | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_devolucion | int unsigned | Sí | FK → devoluciones |  |
| id_detalle_venta | int unsigned | Sí | FK → detalle_ventas |  |
| cantidad | int | Sí |  |  |
| monto | decimal(12,2) | Sí |  |  |

## 18. solicitudes_abastecimiento

Pedido de la tienda a un proveedor (pendiente → aceptada/rechazada → recibida, o cancelada).

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_solicitud | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_proveedor | int unsigned | Sí | FK → proveedores |  |
| id_usuario_creador | int unsigned | Sí | FK → usuarios |  |
| estado | enum('pendiente','aceptada','rechazada','recibida','cancelada') | Sí |  | Por defecto: pendiente |
| nota_tienda | varchar(255) | No |  |  |
| comentario_proveedor | varchar(255) | No |  |  |
| creada_en | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |
| respondida_en | datetime | No |  |  |
| id_usuario_recibio | int unsigned | No | FK → usuarios |  |
| recibida_en | datetime | No |  |  |

## 19. detalle_solicitudes_abastecimiento

Productos y cantidades de cada solicitud.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_detalle_solicitud | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_solicitud | int unsigned | Sí | FK → solicitudes_abastecimiento |  |
| id_producto | int unsigned | Sí | FK → productos |  |
| cantidad | int | Sí |  |  |

## 19b. pedidos

Pedido que un cliente hace desde la tienda en línea. Mientras está *pendiente* o *confirmado* y sin vencer, sus unidades quedan **apartadas** (disponible = stock − apartado). Al entregarlo se registra una venta (`id_venta`).

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_pedido | int unsigned | Sí | PK | AUTO_INCREMENT |
| clave_idempotencia | char(36) | Sí | UK | UUID del navegador: el mismo pedido no se aparta dos veces |
| id_cliente | int unsigned | Sí | FK → clientes | Sale de la sesión, nunca del navegador |
| estado | enum | Sí |  | pendiente, confirmado, entregado, rechazado, cancelado, vencido. Índice (estado, vence_en) |
| total | decimal(12,2) | Sí |  | CHECK ≥ 0. Suma del detalle con los precios del momento del pedido |
| nota_cliente | varchar(255) | No |  | Nota del cliente para la tienda |
| motivo | varchar(255) | No |  | Motivo del rechazo, de la cancelación o del vencimiento |
| creado_en | datetime | Sí |  | Por defecto la fecha actual. Índice (id_cliente, creado_en) |
| vence_en | datetime | Sí |  | Pendiente: creado + `horas_pedido_pendiente`. Confirmado: confirmado + `dias_pedido_confirmado` |
| confirmado_en | datetime | No |  |  |
| cerrado_en | datetime | No |  | Cuándo se entregó, rechazó, canceló o venció |
| id_usuario_atendio | int unsigned | No | FK → usuarios | Quién confirmó, rechazó o entregó |
| id_venta | int unsigned | No | FK → ventas, UK | La venta registrada al entregarlo |

## 19c. detalle_pedidos

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| id_detalle_pedido | int unsigned | Sí | PK | AUTO_INCREMENT |
| id_pedido | int unsigned | Sí | FK → pedidos | UK (id_pedido, id_producto) |
| id_producto | int unsigned | Sí | FK → productos | Índice |
| cantidad | int | Sí |  | CHECK > 0 (máximo 10 lo revisa el backend) |
| precio_unitario | decimal(10,2) | Sí |  | Precio al hacer el pedido: es el que se cobra al entregarlo |
| subtotal | decimal(12,2) | Sí |  |  |

## 20. configuracion

Opciones del sistema (clave → valor). Solo la dueña las cambia.

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| clave | varchar(50) | Sí | PK |  |
| valor | varchar(255) | Sí |  |  |
| descripcion | varchar(255) | Sí |  |  |
| actualizado_en | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |
| id_usuario_actualizo | int unsigned | No | FK → usuarios |  |

## 21. migraciones_aplicadas

Registro de las migraciones ya aplicadas por "npm run migrar".

| Campo | Tipo | Obligatorio | Llave | Notas |
|---|---|---|---|---|
| nombre | varchar(100) | Sí | PK |  |
| aplicada_en | datetime | Sí |  | Por defecto: CURRENT_TIMESTAMP |

## Reglas importantes

1. **Stock:** solo en `productos.stock`, de 0 a 67 (constante `STOCK_MAXIMO`). Solo cambia con `registrarMovimiento()` (CRUD de movimientos, ventas, devoluciones y abastecimiento usan la misma función) dentro de una transacción.
2. **Ventas:** se confirman en una transacción con bloqueo de filas (`SELECT ... FOR UPDATE`); se guarda precio y costo del momento; una salida por producto enlazada con `id_venta`.
3. **Devoluciones:** máximo lo vendido menos lo ya devuelto; entrada enlazada con `id_devolucion`; si pasaría de 67, se rechaza (409).
4. **Cuentas:** el CHECK `ck_usuarios_vinculo` obliga a que un cliente no tenga empleado ni proveedor, un proveedor tenga `id_proveedor` y una cuenta interna tenga `id_empleado`.
5. **Secretos:** contraseñas (Argon2id), códigos (HMAC-SHA256), tokens de sesión y de enlaces (SHA-256) se guardan solo como hash.
6. **Fechas y vencimientos:** se comparan en MySQL con `NOW()`, para no depender del reloj de Node.
7. **Fotos:** una foto con medidas nunca es la foto principal (el backend las ordena al final y responde 409 si se intenta). Máximo 8 por producto y 5 MB por archivo (JPG, PNG o WebP). El backend abre cada foto con `sharp`, la convierte a WebP (máximo 1200 x 1500) y descarta los datos ocultos como el GPS. Al borrar un producto se borran sus fotos (base y disco) en la misma operación.
