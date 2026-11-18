# Registro de pruebas

Entorno de las pruebas (entorno de desarrollo de Claude, no el equipo de Daisy):

- Ubuntu 24.04, Node.js 22.23.4, npm 10.9.9, **MySQL Community Server 8.0.46** real (no MariaDB, no SQLite).
- Navegador real automatizado: Chromium con Playwright (escritorio 1366×900 y celular 390×844).
- Contraseñas con **argon2id** (el paquete `argon2` se instaló bien en Linux).

Todo lo marcado "OK" se ejecutó de verdad. Lo que no se pudo ejecutar está en la última sección, con el motivo.

## Versión 2 · Resumen

| Qué | Cómo | Resultado |
|---|---|---|
| Pruebas automáticas del backend | `npm test` (node:test + supertest contra MySQL real, base `inventario_bisuteria_prueba`) | **81 de 81 OK** (8 archivos; el 7.º es de fotos y subcategorías y el 8.º de pedidos, 6 a 10 de noviembre) |
| Inventario original con roles | `tests/04-inventario-original.test.js` (las comprobaciones del antiguo `npm run probar-api`, ahora con sesión de administrador, MFA y CSRF) | **136 de 136 OK** |
| Flujo completo de los 5 roles en el navegador | `docs/evidencias/e2e_roles.py` (Playwright, modo consola leyendo los códigos del log del backend) | **42 de 42 OK**, sin errores de JavaScript |
| Pantallas del inventario original en el navegador, con sesión de administrador | `docs/evidencias/e2e_inventario.py` (la prueba de 153 pasos de la versión 1, adaptada a /admin, MFA y CSRF): menú, carrusel, filtros, orden, buscador, ficha con entrada/salida, CRUD de las 6 entidades con sus errores 400/409, modales, estados cargando/vacío/guardando/error de conexión, celular y movimiento reducido | **155 de 155 OK** |
| Fotos y subcategorías en el navegador | `docs/evidencias/e2e_fotos.py` (Playwright): portada, catálogo con fotos, filtro Crochet con sus subcategorías, galería con flechas, miniaturas y teclado, buscador con miniaturas, subir/hacer principal/borrar fotos como dueña, formulario con "Crochet › Peluches", página de Categorías y celular | **27 de 27 OK**, sin errores de JavaScript (incluye las fotos con medidas) |
| Pedidos de clientes en el navegador | `docs/evidencias/e2e_pedidos.py` (Playwright, dos navegadores a la vez: clienta y vendedora): armar el pedido sin sesión, iniciar sesión y volver a "Mi pedido", enviar, aviso en la cabecera de Ventas, confirmar, entregar y cobrar, verlo en "Mis compras", rechazar con motivo, cancelar, y "Mi pedido" en celular | **18 de 18 OK**, sin errores de JavaScript |
| Lint | `npm run lint` en `backend` y `frontend` | OK, 0 errores y 0 avisos |
| Build del frontend | `npm run build` | OK |
| Diagramas | Mermaid 11 `mermaid.parse()` en Chromium sobre los dos diagramas | OK, sintaxis válida |
| ZIP desde cero | Se descomprimió el ZIP en una carpeta vacía, `npm ci` en backend y frontend, `.env` copiado de `.env.example`, base nueva con `script.sql` + `npm run migrar` + `npm run seed` + `npm run crear-duena`, backend encendido, `npm test`, lint y build | OK (60/60). Esta prueba encontró el hallazgo 6 de abajo |

## Fase 2 · Migraciones, script.sql y seed

| Prueba | Resultado |
|---|---|
| Base de la v1 con datos (9 productos, 219 unidades, 23 movimientos) + `npm run migrar` | OK: aplica 001 a 005; los datos quedan iguales |
| `npm run migrar` por segunda vez | OK: "ya aplicada" en las 5, no cambia nada |
| Base nueva con `script.sql` + `npm run migrar` | OK: las instrucciones que ya existen se omiten |
| `script.sql` nuevo ejecutado sobre una base v1 + migrar | OK |
| Comparación de esquemas (columnas, índices, llaves foráneas y CHECK) entre v1 migrada y base nueva | OK: idénticos. Automatizado en `tests/06-migraciones.test.js` |
| Ninguna llave foránea con CASCADE | OK (34 FK, todas RESTRICT) |
| `npm run seed` en base nueva, dos veces | OK: la segunda vez todo "omitido"; ventas y devolución del seed generan sus movimientos reales (ARE-002 queda en 24 = 27 − 4 + 1) |
| Cuentas del seed sin contraseña | OK: `hash_contrasena` es NULL en todas; no hay contraseñas en código, seed ni documentación |
| `npm run crear-duena` | OK: pide datos, oculta la contraseña, envía el código (modo consola), rechaza un código incorrecto y acepta el correcto; la contraseña no aparece en la salida. Segunda ejecución: "Ya existe una cuenta de dueña. No se hizo ningún cambio." |

Hallazgo corregido: un `;` dentro de un texto de la migración 005 cortaba la instrucción al dividir el archivo. Se cambió el texto y se dejó la regla anotada en `migrar.js`.

## Fases 3, 4 y 9 · Autenticación, MFA y permisos (`tests/01-mfa.test.js`, `tests/02-permisos.test.js`)

| Caso pedido | Resultado |
|---|---|
| Código MFA correcto → sesión y rol con su pantalla | OK (200, `destino: /pos` para ventas) |
| Código incorrecto | OK (400 "Le quedan 4 intento(s)") |
| Código vencido | OK (400 "venció") |
| Código reutilizado | OK (400; el código y el desafío quedan marcados como usados) |
| Demasiados intentos | OK (el 5.º da 429 y después ni el código correcto sirve) |
| Reenvío antes de 60 s | OK (429 "Espere N segundos") |
| Código anterior después de pedir uno nuevo | OK (el viejo ya no sirve, el nuevo sí) |
| El código se guarda solo como hash | OK (64 caracteres hexadecimales, distinto del número) |
| SMS solo con teléfono verificado | OK (sin teléfono verificado: solo aparece "correo"; con teléfono: entra por SMS y el número va enmascarado) |
| Usuario que solo pasó la contraseña no entra a nada protegido | OK (401 en sesión, perfil, productos, reportes, usuarios, ventas y en un POST) |
| Sin sesión: las 70+ rutas protegidas de la matriz | OK (401 en todas) |
| Por rol: una permitida (200) y una prohibida (403) | OK en los 5 roles |
| Proveedor viendo datos de otro proveedor | OK (404) y al editar "sus datos" con otro `id_proveedor` en el cuerpo, se edita el suyo |
| Cliente viendo el historial de otro cliente | OK (404 en todas las ventas ajenas) |
| Administrador creando administrador o dueña | OK (403); sí puede crear ventas; la invitación sirve una sola vez |
| Registro público enviando `rol: "duena"` | OK: queda como cliente, sin empleado y con correo sin verificar |
| Bloqueo del login tras fallos | OK (5 fallos → 429 aunque después la contraseña sea correcta). También para correos que no existen (misma respuesta) |
| CSRF sin token o con token falso | OK (403) |
| Error genérico en login y recuperación | OK (mismo mensaje exista o no el correo) |
| Logout revoca en el servidor; cookie HttpOnly y SameSite=Lax | OK (la cookie vieja da 401) |
| Vencimiento por inactividad y al desactivar la cuenta | OK (401) |
| Cambiar o restablecer la contraseña cierra las otras sesiones | OK |
| Única dueña activa no puede quitarse el rol; nadie se desactiva a sí mismo | OK (409 y 400) |
| Costo unitario solo para la dueña | OK (admin no lo ve; si lo envía, 403; si edita sin él, se conserva) |
| Auditoría sin contraseñas ni códigos | OK (se buscaron todos los códigos enviados en la prueba: ninguno aparece) |
| Configuración solo la cambia la dueña | OK (admin 403; valores fuera de rango 400; queda en auditoría) |

Hallazgo corregido: con un correo inexistente el 5.º intento respondía 401 y con uno real 429, lo que delataba qué correos existen. Ahora ambos responden igual.

## Fase 6 · Ventas, devoluciones y abastecimiento (`tests/03-ventas.test.js`)

| Caso pedido | Resultado |
|---|---|
| Venta normal | OK: 201, una salida por producto enlazada a la venta, empleado tomado de la sesión, sin costos para el rol ventas |
| Venta sin stock | OK: 409 "quedan 2 y la venta pide 3"; el otro producto de la venta tampoco cambió |
| Misma clave de idempotencia repetida | OK: 201 y luego 200 `repetida`; una sola salida. También con dos envíos **simultáneos** de la misma clave |
| Dos ventas simultáneas de la última unidad | OK: una 201 y otra 409; stock 0 y una sola salida |
| Validaciones (sin clave, sin productos, repetido, cantidad 0, producto inexistente) | OK (400) |
| Movimientos de una venta no se editan ni borran | OK (409 "corrija con una devolución") |
| Rol ventas solo ve y devuelve sus ventas | OK (404 en la de otro vendedor) |
| Devolución normal | OK: 201, entrada enlazada, stock vuelve |
| Devolver más de lo vendido | OK (409 "Solo puede devolver 1") |
| Devolución que pasaría de 67 | OK (409 "máximo de 67") y no se guarda nada |
| Cliente asociado ve la compra en "Mis compras" | OK, sin costos |
| Abastecimiento completo | OK: no se recibe sin aceptar (409), rechazar exige motivo, aceptar, recibir genera las entradas; una que pasaría de 67 no se recibe (409) y se puede cancelar |
| Ganancia del dashboard | OK: coincide con un cálculo independiente en SQL; avisa que es parcial si faltan costos |

## Fase 8 · Correo y SMS reales (`tests/05-envios.test.js`)

Sin las credenciales de Daisy no se puede usar Gmail ni Twilio. Para probar **el mismo código** que se usa con ellos:

| Prueba | Resultado |
|---|---|
| Servidor SMTP real local (paquete `smtp-server`) con usuario y contraseña: registro → llega el correo con el código → se verifica → login con MFA por correo | OK |
| SMTP con contraseña incorrecta | OK: 503 "...contraseña de aplicación", no dice "enviamos" y **no se crea la cuenta** |
| Sin SMTP configurado y sin modo consola | OK: 503 claro |
| Servidor HTTP que imita la API de Twilio: verificación de teléfono `+506 8877-6655` | OK: llega a `/2010-04-01/Accounts/AC.../Messages.json` con autenticación Basic, `To=+50688776655`, y el código del SMS verifica el teléfono |
| Twilio responde error 21608 (número no verificado en cuenta de prueba) | OK: 503 que lo explica |
| Modo consola con `NODE_ENV=production` | OK: no se activa aunque `MFA_MODO_CONSOLA=true` |

## Fases 5 y 7 · Interfaces en el navegador (`docs/evidencias/e2e_roles.py`)

Base de desarrollo reconstruida desde cero (script.sql, migrar, seed, crear-duena), backend con modo consola y frontend con Vite. Resultado: **42 de 42 OK**:

- Visitante: bienvenida, catálogo con disponibilidad (sin stock exacto), ruta privada → login, error genérico.
- Dueña: MFA → /duena, gráficos de Recharts, aviso de costos faltantes, filtro de fechas, registrar costo, cambiar configuración, reenviar 3 invitaciones, corregir el correo de una invitación pendiente.
- Invitaciones: las 3 cuentas definen contraseña; el enlace no sirve dos veces.
- Ventas: MFA → /pos, alerta de stock insuficiente (botón deshabilitado), venta asociada a una clienta, devolución; /admin/usuarios → "no es para su cuenta".
- Administración: MFA → /admin, crear solicitud de abastecimiento, /duena prohibido, no ve costos, solo puede crear cuentas de Ventas y Proveedor, recibir la solicitud, movimientos con columna Origen y sin editar/eliminar en los de ventas.
- Proveedor: MFA → /proveedor, aceptar la solicitud, ve solo sus productos.
- Sesión vencida (cookies borradas) → login con mensaje.
- Cliente nuevo: registro, verificación de correo, /cliente, verificación de teléfono y login por **SMS**.
- Cliente del seed: recuperar contraseña con el enlace, ver su compra (sin costos), /pos prohibido.
- Celular: catálogo y punto de venta sin desborde horizontal.

Capturas en `docs/evidencias/capturas/`.

Hallazgos corregidos gracias a esta prueba:

1. Guardar la configuración daba error 500 (`descripcion` sin valor por defecto). Se corrigió y se agregó la prueba automática que faltaba.
2. Los clientes del seed no podían usar "Olvidé mi contraseña" (no tenían contraseña). Ahora sí; las cuentas internas sin contraseña siguen usando su invitación.
3. Validar y aceptar invitaciones compartía el límite de "recuperación" (10 por hora por IP) y se agotaba rápido; ahora tienen su propio límite (`LIMITE_ENLACES_POR_IP`).
4. El máximo de códigos por hora (5) era muy bajo para entrar y salir varias veces; quedó en 10 (`CODIGOS_MAXIMO_POR_HORA`).
5. Un componente del dashboard usaba un nombre inexistente (pantalla en blanco). Se agregó la regla `react/jsx-no-undef` al lint del frontend para que no vuelva a pasar.
6. Con el `.env` copiado tal cual de `.env.example`, `npm test` fallaba (22 pruebas) porque tomaba los límites por IP del `.env` (todas las pruebas vienen de la misma IP). Ahora, con `NODE_ENV=test`, esos límites se ignoran; el bloqueo por cuenta sí se prueba.
7. Segunda revisión: faltaba "editar" cuentas (lo pide el rol de administración). Se agregó corregir el correo de una invitación pendiente (`PATCH /api/usuarios/:id/correo`, con prueba automática y en el navegador); los datos de la persona se editan en Empleados o Proveedores.
8. Con el backend apagado, el proxy de Vite responde 502 sin JSON y la pantalla mostraba "No se pudieron cargar los datos"; además, al recargar con el backend apagado, la app mandaba al login aunque la sesión seguía viva. Ahora muestra "Error de conexión" con **Reintentar** y, al volver el backend, sigue en la misma página con la sesión.

## Fotos, subcategorías y productos de Desy (6 de noviembre)

Se agregaron los 12 productos reales de Desy (29 fotos de su ZIP), subcategorías (Crochet > Peluches, Llaveros de crochet, Decoración) y la administración de fotos.

| Qué se probó | Cómo | Resultado |
|---|---|---|
| Actualizar una base que ya tenía la versión 2 (como la de Daisy) | Base creada con el código anterior (migraciones 001–005 + seed + dueña), después el código nuevo: `npm run migrar` y `npm run seed` | OK: se aplicó solo la 006; se crearon 5 categorías, 4 materiales, 12 productos y 29 fotos; "Collares" ya existía y se reutilizó; ningún dato anterior cambió |
| Base v1 + migraciones = base nueva | `tests/06-migraciones.test.js` (ahora con 6 migraciones) | OK: mismo esquema exacto, sin CASCADE |
| Seed: productos, fotos, stock por movimientos, subcategorías | `tests/07-fotos-y-subcategorias.test.js` | OK: 12 productos con foto principal, 29 archivos en la carpeta de fotos, stock inicial como entrada en Movimientos, el catálogo no muestra el stock exacto |
| Seed otra vez | mismo archivo | OK: no duplica productos, fotos ni movimientos; vuelve a copiar una foto que se borró de la carpeta |
| Servir fotos | mismo archivo | OK: 200 `image/webp`; 404 para `../.env`, nombres en mayúsculas, `.png` y fotos que no existen |
| Subir fotos | mismo archivo | OK: JPEG con GPS → WebP sin EXIF y con nombre al azar; texto con extensión `.png` → 400; 50 x 50 px → 400; GIF → 400; más de 5 MB → 413; sin foto u otro campo → 400; la novena foto → 409; producto inexistente → 404; queda en auditoría |
| Foto principal y borrar | mismo archivo | OK: cambia el orden y la foto del catálogo; borra el archivo del disco; una foto de otro producto → 404 |
| Permisos de fotos | mismo archivo | OK: ventas, cliente y proveedor → 403; sin sesión → 401; sin CSRF → 403; la dueña sí puede |
| Borrar un producto con fotos | mismo archivo | OK: se borran sus fotos de la base y del disco |
| Subcategorías | mismo archivo | OK: crear dentro de Crochet; dentro de una subcategoría → 400; dentro de sí misma → 400; una categoría con subcategorías no puede quedar dentro de otra → 400; editar sin enviar la principal la conserva; borrar Crochet → 409 |
| Inventario y roles en el navegador después del cambio | `e2e_roles.py` y `e2e_inventario.py` | **42 de 42** y **155 de 155 OK**. En `e2e_inventario.py` se actualizaron los números que dependen de los datos (21 productos, 7 categorías principales, 10 materiales) y el paso de crear producto, que ahora abre la ventana de fotos |

Hallazgo corregido gracias a la prueba en el navegador: un producto sin foto de una categoría sin "palabra conocida" y sin categoría principal dejaba la pantalla en blanco (`null.toLowerCase()` en `IconoCategoria.jsx`). Ahora el nombre vacío o `null` usa el ícono de gema.

Capturas nuevas: `docs/evidencias/capturas/16-catalogo-crochet-fotos.png` a `20-celular-ficha.png`.

## Fotos con medidas (9 de noviembre)

Pedido: "las fotos con medidas no pueden salir de primero nunca". En el ZIP, la primera foto de Batman y de la flor tenía medidas.

| Qué se probó | Cómo | Resultado |
|---|---|---|
| Actualizar una base que ya tenía las fotos cargadas (como la de Daisy) | Base con el código del 6 de noviembre (migraciones 001–006 + seed), después el código nuevo: `npm run migrar` y `npm run cargar-productos` | OK: se aplicó solo la 007; quedaron marcadas las 9 fotos con medidas; Batman y la flor muestran primero la foto sin medidas; no se duplicó nada |
| Seed nuevo | `tests/07` | OK: 9 fotos con medidas, ninguna tarjeta del catálogo usa una; en la ficha van al final (`fotos_medidas` en la respuesta) |
| Reglas | `tests/07` ("Fotos con medidas...") | OK: hacer principal una foto con medidas → 409; marcar la principal como medidas → se va al final y la siguiente pasa a ser la principal; subir con `es_de_medidas=true` → queda al final; quitar la marca → vuelve con las normales; valor inválido → 400; foto de otro producto → 404; ventas → 403; producto con solo fotos de medidas → `foto_principal` null |
| En el navegador | `e2e_fotos.py` | OK: la tarjeta y la ficha de Batman abren con la foto sin medidas; la de medidas dice "Medidas"; en la ventana de fotos no tiene estrella; marcar la única normal avisa que se verá un ícono; quitar la marca la devuelve como principal. Captura `21-fotos-medidas.png` |
| Lo anterior sigue igual | `e2e_roles.py`, `e2e_inventario.py`, `npm test` | 42/42, 155/155 y 71/71 OK |

## Pedidos de clientes con productos apartados (10 de noviembre)

Pedido: que los clientes hagan pedidos, que se aparten las unidades y que esperen la confirmación de la tienda. Decisiones de Daisy: confirmar = "listo para recoger" y al entregar se registra la venta; los pedidos vencen solos (48 horas para confirmar, 7 días para recoger, configurables); atienden Ventas, Administración y Dueña; se avisa por correo.

| Qué se probó | Cómo | Resultado |
|---|---|---|
| Actualizar una base con la versión del 9 de noviembre (migraciones 001–007 + seed) | Base con el código anterior y después el código nuevo: `npm run migrar` | OK: se aplicó solo la 008 (2 tablas y 2 opciones de configuración); productos, stock y ventas quedaron igual |
| Base v1 + migraciones = base nueva | `tests/06-migraciones.test.js` (ahora con 8 migraciones) | OK: mismo esquema exacto, sin CASCADE |
| Apartar | `tests/08-pedidos.test.js` | OK: el pedido queda pendiente con plazo de 48 horas; el stock físico **no** cambia; `apartado` sube; el punto de venta muestra lo disponible; aviso "Recibimos su pedido"; cada cliente ve solo los suyos (otro → 404) |
| Idempotencia | mismo archivo | OK: la misma clave dos veces → un solo pedido (200 `repetido`) y se aparta una sola vez |
| Lo apartado está protegido | mismo archivo | OK: otro cliente no puede pedirlo (409 "solo quedan N"), el punto de venta no lo vende (409 "apartadas en pedidos") y una salida a mano tampoco (409); el stock no cambia |
| Confirmar y entregar | mismo archivo | OK: confirmar → plazo de 7 días y aviso; no se confirma dos veces; entregar sin confirmar → 409; al entregar se registra la venta con el **precio del pedido** aunque el producto subió, una salida enlazada a la venta, `apartado` vuelve a 0, aparece en "Mis compras"; no se entrega dos veces ni se cancela después |
| Rechazar | mismo archivo | OK: sin motivo o con 1 letra → 400; con motivo → rechazado, libera las unidades y el correo lleva el motivo |
| Vencer | mismo archivo | OK: un pedido con el plazo pasado deja de apartar **al instante**; no se puede confirmar (409); la revisión lo marca como vencido con su motivo y avisa una sola vez |
| Límites y validaciones | mismo archivo | OK: el 4.º pedido en curso → 409 (cancelar libera el cupo); sin clave, vacío, cantidad 0 u 11, repetido, producto inexistente, nota de 256 letras → 400; producto agotado → 409 |
| Permisos | mismo archivo | OK: cliente no ve la bandeja (403); ventas no puede pedir (403); proveedor 403; sin sesión 401; sin CSRF 403; el `id_cliente` del cuerpo se ignora; administración y dueña también atienden |
| Configuración | mismo archivo | OK: la dueña cambia las horas para confirmar (0 → 400; 2 → el pedido vence en 2 horas); administración no puede (403) |
| En el navegador | `e2e_pedidos.py` | 18/18 (ver tabla de arriba). Capturas en `docs/evidencias/capturas/22-mi-pedido.png` a `26-celular-mi-pedido.png` |
| Lo anterior sigue igual | `e2e_roles.py`, `e2e_inventario.py`, `e2e_fotos.py`, `npm test` | 43/43, 155/155, 27/27 y 81/81 OK |

Hallazgos corregidos gracias a estas pruebas:

1. Después del código de verificación, la app siempre llevaba a la pantalla del rol aunque la persona viniera de otra página protegida (el regreso a "Mi pedido" no funcionaba). Ahora vuelve a donde estaba (solo direcciones de este mismo sitio). `e2e_roles.py` ahora lo comprueba.
2. Por lo mismo, después de "Cerrar sesión" la próxima persona que entraba en ese navegador iba a la última página de la anterior. Ahora, al cerrar sesión, esa página no se recuerda.
3. Las fechas de vencimiento se calculan en MySQL (`DATE_ADD(NOW(), ...)`). En una computadora donde MySQL y Node tienen la misma zona horaria (como la de Daisy) se ven bien; las pruebas comparan los plazos en MySQL para no depender de la zona.

## Lo que NO se pudo probar aquí (pendiente en el equipo de Daisy)

| Qué | Por qué | Cómo probarlo |
|---|---|---|
| Envío real con **Gmail** | Necesita su cuenta y su contraseña de aplicación | README sección 6 |
| Envío real con **Twilio** | Necesita su cuenta. Además, según la documentación actual de Twilio, la cuenta de prueba no permite textos propios y solo envía a números verificados de su país, así que puede rechazar los códigos de Desy | README sección 7 |
| Windows + VS Code + MySQL 8.4 | El entorno de prueba es Linux con MySQL 8.0.46 (el código usa solo funciones de 8.0 que también existen en 8.4) | Secciones 2 a 9 del README |
| Instalación de `argon2` en Windows | Se probó en Linux. Si en Windows falla, el backend usa bcrypt (costo 12) automáticamente y lo dice al arrancar | Mire la línea `Contraseñas:` al iniciar el backend |
| `npm run migrar` sobre **su** base de la v1 | Se probó con una copia equivalente | Antes de migrar, haga un respaldo en Workbench (Server → Data Export) |
| Instalación de `sharp` (fotos) en Windows | Se probó en Linux. `sharp` trae binarios listos para Windows x64, pero no se pudo comprobar en su equipo | `npm install` en `backend`; si falla, vea README sección 13 |
| Precios reales de los 12 productos | Los del ZIP no traían precio | Están en `backend/database/productos-desy.json` (precios de ejemplo); cámbielos ahí antes de cargarlos o después en Productos |


---

## Anexo · Pruebas de la versión 1 (4 de noviembre)

Entorno donde se hicieron las pruebas (entorno de desarrollo de Claude):

- Ubuntu 24.04 (Linux), Node.js 22.23.4, npm 10.9.9.
- **MySQL Community Server 8.0.46** (paquete oficial `mysql-server-8.0` de Ubuntu; no MariaDB, no XAMPP, no SQLite).
- Navegador automatizado: Chromium con Playwright.

Cada sección dice qué se ejecutó, qué resultado dio y qué queda pendiente de probar en el equipo de Daisy (Windows + VS Code).

### Etapa 1 · Modelo de datos, script.sql y diagramas

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Crear la BD desde cero | `mysql -u root < database/script.sql` | OK: se crean la BD `inventario_bisuteria` y las 6 tablas |
| Ejecutar el script por segunda vez | mismo comando | OK: no da error ni borra nada (usa `IF NOT EXISTS`) |
| Revisar llaves foráneas | consulta a `information_schema.REFERENTIAL_CONSTRAINTS` | OK: 5 FK, todas `RESTRICT` en DELETE y UPDATE (sin cascada) |
| Unicidad sin distinguir mayúsculas | insertar categoría "Prueba" y luego "prueba" | OK: la segunda da `ERROR 1062 Duplicate entry` |
| CHECK de stock mínimo | insertar producto con `stock = -1` | OK: `ERROR 3819 Check constraint 'ck_productos_stock_minimo' is violated` |
| FK inexistente | insertar producto con `id_categoria = 999` | OK: `ERROR 1452 ... foreign key constraint fails` |
| Diagramas Mermaid | se renderizaron `diagrama-simple.md` y `diagrama-completo.md` con Mermaid CLI (`mmdc`) | OK: ambos generan la imagen sin errores de sintaxis |

Pendiente en el equipo de Daisy: ejecutar `script.sql` en su MySQL 8 de Windows (pasos en el README).

### Etapa 2 · Conexión a MySQL y seed

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Instalar dependencias del backend | `npm install` (carpeta `backend`) | OK, 0 vulnerabilidades |
| Seed, primera vez | `npm run seed` | OK: inserta 5 categorías, 4 proveedores, 6 materiales, 3 empleados, 9 productos y 23 movimientos |
| Seed, segunda vez seguida | `npm run seed` | OK: inserta 0 y omite todo; los conteos en MySQL siguen iguales (no duplica) |
| Stock calculado por el seed | resumen del seed | OK: ARE-001 18, ARE-002 27, COL-001 20, COL-002 0, PUL-001 14, PUL-002 65, ANI-001 9, CAB-001 26, CAB-002 40 (todos entre 0 y 67, coinciden con la suma de sus movimientos) |
| No sobrescribe lo editado | se cambió el nombre de la categoría 1 y se volvió a ejecutar el seed | OK: conserva "Aretes (editado)" |
| Recrea lo borrado | se borró el movimiento 23 (y se revirtió su salida) y se volvió a ejecutar | OK: vuelve a crear el movimiento 23 y el stock de ARE-002 vuelve a 27 |
| Transacción y ROLLBACK | copia de prueba de `db.json` con una categoría nueva válida y un material con nombre de 80 caracteres | OK: falla el material, se muestra "se revirtieron TODOS los cambios" y la categoría nueva tampoco quedó guardada |
| Cierre de conexiones | el proceso termina solo después del resumen | OK (`pool.end()`) |

Hallazgo: si la contraseña de MySQL contiene `#`, dotenv la corta (lo toma como comentario). Solución: escribirla entre comillas en `.env`, por ejemplo `DB_PASSWORD="Mi#Clave"`. Quedó anotado en el README.

### Etapas 3 y 4 · Backend (CRUDs, validaciones, errores) y lógica del stock

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Linter del backend | `npm run lint` (carpeta `backend`) | OK, 0 errores y 0 advertencias |
| Arranque del servidor | `npm run dev` | OK: "API escuchando en http://localhost:3000/api" y "Conectado a MySQL" |
| Script de pruebas de la API (equivale a Thunder Client/Postman) | `npm run probar-api` con el backend encendido | **OK: 135 pruebas, 135 correctas, 0 con falla** |
| Los 5 endpoints de las 6 entidades | incluido en el script | OK: POST 201, GET lista 200 (arreglo), GET uno 200, PUT 200, DELETE 200 con `{ message, id }` |
| PUT sin cambios | incluido en el script | OK: 200 (no se confunde con 404) en las 6 entidades |
| Campos vacíos o con solo espacios | incluido | OK: 400 |
| Tipos incorrectos (número en vez de texto, texto en vez de número o booleano, cantidad decimal) | incluido | OK: 400 |
| Longitud máxima, correo y teléfono sin formato, precio negativo o con 3 decimales, fecha imposible (2026-02-30) | incluido | OK: 400 |
| ID inexistente (GET, PUT, DELETE) | incluido | OK: 404 |
| ID inválido (`abc`, `0`) | incluido | OK: 400 |
| Llave foránea inexistente (categoría, proveedor, producto, empleado) | incluido | OK: 400 con mensaje claro |
| Duplicados (incluso "ARETES" contra "Aretes") | incluido | OK: 409 |
| Eliminar con dependencias (categoría, proveedor, material, producto, empleado) | incluido | OK: 409 con el número de registros relacionados |
| Intentar poner el stock en POST/PUT de productos | incluido | OK: 400 y el stock no cambia |
| JSON malformado, cuerpo que no es objeto, sin cuerpo | incluido | OK: 400 |
| Ruta inexistente y método no soportado | incluido | OK: 404 en JSON |
| CORS | incluido | OK: responde `Access-Control-Allow-Origin: http://localhost:5173` (no `*`) |
| Stock: entrada normal (0 + 60) | incluido | OK: stock 60 |
| Stock: entrada que supera 67 (60 + 10) | incluido | OK: 409 y el stock sigue en 60 |
| Stock: salida normal (60 - 25) | incluido | OK: stock 35 |
| Stock: salida que deja negativo (35 - 40) | incluido | OK: 409 y el stock sigue en 35 |
| Stock: editar salida 25 → 30 | incluido | OK: stock 30 (revierte y aplica) |
| Stock: editar salida 30 → entrada 5 | incluido | OK: stock 65 |
| Stock: editar a entrada 10 (quedaría 70) | incluido | OK: 409 y el stock sigue en 65 |
| Stock: eliminar la entrada de 60 | incluido | OK: stock 5 (revierte su efecto) |
| Stock: salida hasta 0 y luego eliminar una entrada ya vendida | incluido | OK: 0 permitido; eliminar da 409 y el stock sigue en 0 |
| Stock: editar un movimiento cambiándolo de producto | incluido | OK: el producto viejo recupera y el nuevo descuenta |
| Transacción con rechazo en el segundo producto | incluido | OK: ningún producto cambia |
| Limpieza del script | incluido | OK: borra todo lo que creó; los datos del seed quedan iguales (5, 4, 6, 3, 9, 23 registros y los mismos stocks) |
| Listado vacío | segundo servidor apuntando a una BD vacía | OK: las 6 entidades devuelven `[]` con 200 |
| MySQL apagado | `service mysql stop` y `GET /api/productos` | OK: 500 con "No se pudo conectar con la base de datos..." y sin detalles internos |
| Error inesperado | mini app de prueba que lanza un error con SQL y contraseña en el mensaje | OK: 500 con "Ocurrió un error inesperado en el servidor." (no muestra el SQL ni la contraseña) |
| Mensaje del stock máximo | `POST /api/movimientos` entrada de 5 a PUL-002 (65) | OK: "La entrada supera el stock máximo de 67 unidades. "Pulsera tejida de hilo" tiene 65; como máximo puede ingresar 2." |

### Etapas 5 y 6 · Frontend, animaciones, gráfico, íconos y notificaciones

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Instalar dependencias del frontend | `npm install` (carpeta `frontend`) | OK, 0 vulnerabilidades |
| Linter del frontend | `npm run lint` | OK, 0 errores y 0 advertencias. Se agregó `eslint-plugin-react` (regla `jsx-uses-vars`) para que ESLint detecte de verdad los imports sin usar en JSX |
| Build | `npm run build` | OK: genera `dist/` sin errores |
| Recorrido de las 8 páginas | Chromium automatizado (Playwright) en 1366×900 | OK: todas cargan datos reales de MySQL, sin errores de JavaScript |
| Prueba de punta a punta en el navegador | script Playwright contra el backend real y MySQL 8 | **OK: 117 pruebas, 117 correctas, 0 con falla** |

Detalle de lo que se probó en el navegador:

- **CRUD desde los formularios** de categorías, proveedores, materiales, empleados, productos y movimientos: crear, editar y eliminar; la tabla se actualiza sin recargar la página y el formulario se limpia después de guardar.
- **Mensajes del backend visibles** (toast y recuadro rojo en el formulario): duplicado (409), campo con solo espacios (400), precio vacío (400), categoría con productos (409), producto con movimientos (409), entrada que supera 67 (409, mensaje "supera el stock máximo de 67"), salida que deja el stock negativo (409) y eliminar una entrada ya vendida (409).
- **El formulario conserva lo escrito** cuando hay un error.
- **Selectores con nombres**: categoría, material, proveedor, producto y empleado se eligen por nombre; el usuario nunca escribe IDs.
- **Productos**: el formulario no tiene campo de stock; un producto nuevo aparece con "0 / 67"; el aviso muestra el máximo obtenido de `GET /api/configuracion`.
- **Movimientos**: el panel muestra stock actual, máximo permitido (67) y cómo quedaría; avisa antes de guardar si se pasaría del rango. Entrada 60 → stock 60; entrada 10 → rechazada; salida 61 → rechazada; salida 15 → 45; editar 15 → 20 → 40; eliminar la salida → 60.
- **Modal de confirmación**: el foco empieza en "Cancelar", Tab no sale del modal, Escape y Cancelar cierran sin eliminar, confirmar elimina.
- **Estados**: "Cargando datos...", "sin registros", "Error de conexión" (con el backend apagado de verdad) y "Reintentar" cuando vuelve; "Guardando..." y "Eliminando..." con botones deshabilitados durante la petición.
- **Animaciones (Motion)**: entrada de página (opacidad de menos de 1 a 1), filas escalonadas, apertura/cierre del modal y hover del botón (cambia su `transform`).
- **Movimiento reducido**: con `prefers-reduced-motion: reduce` la página entra sin desplazamiento.
- **Gráfico (Recharts)**: una barra por producto con datos de la API, línea punteada "Máximo: 67" y detalle al pasar el mouse. Al crear un producto y darle entrada, su barra aparece en el gráfico.
- **Celular (390 px)**: sin desbordamiento horizontal; el menú pasa arriba y las tablas se muestran como tarjetas.
- Al terminar, las pruebas borraron todo lo que crearon desde la interfaz; la base quedó con los datos del seed (stocks 18, 27, 20, 0, 14, 65, 9, 26, 40).

Nota: en la consola del navegador de prueba apareció un aviso del WebSocket de recarga en vivo de Vite. Se debe a que en este entorno Vite se arrancó en `127.0.0.1` y el navegador abrió `localhost`; no es un error de la aplicación. Con `npm run dev` normal no ocurre.

Ajuste hecho gracias a las capturas: con el formulario y la tabla lado a lado, la tabla de movimientos quedaba apretada y se cortaba la columna "Stock actual". Se cambió la disposición: formulario arriba (sus campos se acomodan en columnas) y tabla debajo a todo el ancho.

### Etapas 7 y 8 · Documentación, revisión final y ZIP

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Nombres consistentes | Script que compara tablas y campos de `script.sql` con `db.json`, ambos diagramas, el diccionario, el backend y el frontend; rutas del frontend contra las del backend; búsqueda de `fetch`/URL en páginas y componentes; búsqueda del número 67 | OK: sin diferencias; el 67 solo está en `constantes.js` (y en comentarios); ninguna página ni componente llama a la API directamente |
| Restos sin usar | Búsqueda de `TODO`, `FIXME` y `console.log` sueltos; revisión de archivos de la plantilla de Vite | OK. Se borraron `frontend/.oxlintrc.json` y un `.gitignore` duplicado que venían de la plantilla |
| Comando de Windows para crear la BD | `mysql -u root -p -e "source database/script.sql"` (funciona en PowerShell y CMD) | OK en MySQL 8.0.46 |
| ZIP sin contenido prohibido | `unzip -l` del ZIP | OK: no tiene `node_modules`, `.env`, `dist`, `.git` ni `.log`; la carpeta raíz es `mini-proyecto-1/` |
| **Instalación desde cero con el ZIP** | Se descomprimió el ZIP en una carpeta nueva, se borró la base de datos y se siguió el README: `script.sql`, copiar `.env.example`, `npm ci` en las dos carpetas, `npm run lint`, `npm run seed` dos veces, `npm run dev`, `npm run build`, `npm run probar-api` | OK: lint sin errores en las dos carpetas, build correcto, seed 5/4/6/3/9/23 y luego todo omitido, **API 135/135** |
| **Navegador contra la copia limpia** | Misma prueba Playwright de las etapas 5 y 6 | OK: **117/117**; al final la base quedó con los datos del seed |

### Pendiente de probar en el equipo de Daisy (Windows + VS Code)

1. Instalar **MySQL 8.4 LTS** y ejecutar `script.sql`. En este entorno no se pudo descargar MySQL 8.4 (solo estaba disponible 8.0.46). El proyecto usa únicamente funciones que existen igual en 8.0 y 8.4 (CHECK, ENUM, `utf8mb4_0900_ai_ci`, autenticación `caching_sha2_password`, que `mysql2` soporta).
2. Seguir el README en Windows: `npm install`, `.env`, `npm run seed`, `npm run dev` en las dos carpetas, y abrir <http://localhost:5173>.
3. Ejecutar `npm run probar-api` (debe decir 135 correctas) y recorrer los formularios como indica el README, sección 11.
4. Crear el repositorio en GitHub y subir el proyecto (README, sección 14).

### Rediseño estilo tienda en línea y nombre "Desy"

Daisy envió una captura y un video de una tienda en línea como referencia de diseño, y pidió que la empresa se llame **Desy**. Se rehízo la interfaz (el backend no cambió).

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Linter del frontend | `npm run lint` | OK, 0 errores y 0 advertencias. ESLint detectó dos problemas reales que se corrigieron: un ícono elegido "durante el render" (ahora es el componente fijo `IconoCategoria`) y una constante exportada junto a un componente (ahora está en `utils/filtrosProductos.js`) |
| Build | `npm run build` | OK |
| API (sin cambios) | `npm run probar-api` | OK: 135/135 |
| **Prueba de punta a punta en el navegador (nueva)** | Script Playwright actualizado para el diseño nuevo | **OK: 151 pruebas, 151 correctas, 0 con falla**, sin errores en la consola |
| Datos al terminar | conteo en MySQL | 5, 4, 6, 3, 9 y 23 registros; stocks 18, 27, 20, 0, 14, 65, 9, 26, 40 (iguales al seed) |

Lo nuevo que se probó en el navegador:

- Cabecera con el nombre "desy" y la pestaña "Desy · Inventario"; menú ☰ que entra desde la izquierda, se cierra con Escape y al elegir una página; pie de página con accesos.
- Inicio: el carrusel cambia con la flecha y usa datos reales (productos agotados); "Nuestras categorías" abre el catálogo ya filtrado (Aretes → 2 de 9); "Productos con poco stock" empieza por el agotado; el gráfico sigue con 8 barras y la línea "Máximo: 67".
- Catálogo: 9 tarjetas; secciones de filtros cerradas al inicio; filtro por categoría, disponibilidad y precio; aviso amarillo "No encontramos productos que coincidan con la selección"; "Limpiar filtros"; "Ordenar por" precio y stock.
- Buscador: "pul" sugiere 2 productos; Enter abre "Resultados de búsqueda para: 'pul'" con "2 producto(s) encontrado(s)"; el chip quita la búsqueda; una sugerencia abre la ficha.
- Ficha: migas Inicio > Productos > categoría > producto; "14 unidades disponibles en stock (máximo 67)"; sin empleado → 400; con + y − la cantidad sube a 3; "Registrar entrada" → stock 17; "Registrar salida" → 14; pestaña Movimientos; Productos similares; entrada que pasa de 67 → 409; producto inexistente → "no existe". Los 2 movimientos creados se borraron al final.
- Productos en modal: "Nuevo producto" abre el modal con el foco en Código; sin campo de stock; precio vacío → 400 y el modal conserva lo escrito; crear, editar (precio) y Escape; eliminar desde la tarjeta con el modal de confirmación.
- Se repitieron todas las pruebas anteriores: CRUD de las demás entidades, reglas del stock en Movimientos, estados (cargando, sin registros, guardando, eliminando, error de conexión con el backend apagado de verdad y Reintentar), animaciones (página, filas, hover de tarjeta y botón) y movimiento reducido.
- Celular (390 px): sin desbordes, dos tarjetas por fila y el botón "Filtros" despliega las secciones.

| Instalación desde cero con el ZIP nuevo | ZIP descomprimido en una carpeta vacía, base de datos borrada, `script.sql`, `npm ci`, lint, seed dos veces, build, `npm run probar-api` y la prueba del navegador | OK: lint sin errores, build correcto, seed 23 y luego 0 insertados, API 135/135, navegador 150/151. La falla era real y se corrigió (ver abajo); después de corregirla: **151/151** |

Falla encontrada en la instalación desde cero: con "reducir movimiento" activo, la página a veces se desplazaba al entrar, porque Motion detectaba la preferencia un instante después del primer dibujo. Se corrigió en `PaginaAnimada.jsx` leyendo la preferencia con `useReducedMotion`. Se comprobó 10 veces seguidas en 5 páginas distintas: 10/10 sin desplazamiento.

Ajustes hechos al revisar las capturas: el menú lateral aparecía en el centro (una regla CSS lo pisaba), la imagen de la ficha era demasiado grande, en celular el ícono de la tarjeta quedaba debajo de los botones, y las tarjetas no se encogían (quedaba una por fila).

Pendiente en el equipo de Daisy: ver el diseño en su Windows. Si tiene la letra Century Gothic (viene con Microsoft Office) se usará esa, que es la de la referencia; si no, se verá con Urbanist, la que aparece en las capturas de estas pruebas.

### Logo de Desy

Daisy envió el logo de la empresa. Se preparó la imagen (fondo blanco → transparente, márgenes recortados, versión cuadrada de la flor para el ícono de la pestaña) y se colocó en la cabecera, el menú lateral y el pie de página.

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Linter y build del frontend | `npm run lint` y `npm run build` | OK, 0 errores y 0 advertencias; el logo se incluye en el build |
| Revisión visual | capturas en 1440 px, 390 px y 360 px | OK: el logo se ve nítido sobre el fondo de la cabecera; en celular el logo, "inventario" y los accesos caben en una fila sin desbordes |
| Prueba del navegador | script Playwright (con tres pruebas nuevas del logo) | **OK: 153/153** |
| API | `npm run probar-api` | OK: 135/135 |

Ajuste hecho al revisar las capturas: en celular el logo con la palabra "inventario" empujaba los accesos a otra línea; se achicó esa palabra en pantallas pequeñas.

### Paleta de colores del logo

Daisy pidió que los colores combinen con el logo. Se cambió el azul por los colores del logo: fondo crema, café oscuro (títulos, botones, pie de página), verde hoja (precios, enlaces, subrayado de pestañas), verde claro y amarillo (acentos como el contador de filtros y el punto activo del carrusel). Los fondos de las tarjetas y los anuncios del carrusel también se pasaron a tonos del logo.

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Contraste de los textos | cálculo de contraste WCAG de cada combinación | OK: texto principal 13.4:1, secundario 6.2:1, precios en verde 5.2:1, botones café con letra blanca 12.2:1, anuncios 4.7:1 o más |
| Color del gráfico | validador de paletas (daltonismo, luminosidad, croma, contraste) con `#5a9a3c` | OK: pasa todas las comprobaciones |
| Restos del color viejo | búsqueda de "azul" y de los colores viejos en el CSS; revisión de que toda variable usada esté definida | OK: no quedó ninguno |
| Linter y build del frontend | `npm run lint`, `npm run build` | OK |
| Prueba del navegador | script Playwright | **OK: 153/153** |
| API | `npm run probar-api` | OK: 135/135 |
