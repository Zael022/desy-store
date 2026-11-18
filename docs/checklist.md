# Checklist final (versión 2)

Estados:

- **Implementado y verificado**: se ejecutó de verdad (ver [pruebas.md](pruebas.md)).
- **Implementado, pendiente de prueba local**: está hecho, falta confirmarlo en el equipo de Daisy.
- **Pendiente de acción del usuario**: lo tiene que hacer Daisy.

| Requisito | Archivo | Evidencia | Estado |
|---|---|---|---|
| Fase 1: análisis inicial y diseño | docs/analisis-inicial.md | Documento con tablas, endpoints, reglas y diseño | Implementado y verificado |
| Mantener arquitectura, logo y paleta; todo lo anterior sigue funcionando | frontend/src/index.css, tests/04-inventario-original.test.js | 136/136 comprobaciones del inventario original con rol administrador | Implementado y verificado |
| Stock máximo 67 en un solo lugar | backend/src/config/constantes.js | Pruebas de 409 al pasar 67 (movimientos, devoluciones, abastecimiento) | Implementado y verificado |
| Migraciones numeradas, `npm run migrar` repetible, registro de aplicadas | backend/database/migraciones/, backend/database/migrar.js | tests/06-migraciones.test.js (v1 migrada = base nueva; segunda vez 0 aplicadas) | Implementado y verificado |
| script.sql deja la base igual a una migrada | backend/database/script.sql | Comparación de columnas, índices, FK y CHECK en tests/06 | Implementado y verificado |
| Tablas nuevas con PK, FK, índices y sin cascada | migraciones 001 a 008 | 41 FK RESTRICT (prueba "Ninguna llave foránea usa CASCADE") | Implementado y verificado |
| db.json y seed con datos coherentes, sin contraseñas publicadas | backend/database/db.json, seed.js | Cuentas del seed con hash NULL; ventas del seed generan movimientos reales | Implementado y verificado |
| Diagramas y diccionario actualizados | docs/diagrama-*.md, docs/diccionario-de-datos.md | Mermaid 11 parse OK; diccionario generado de la base real | Implementado y verificado |
| Registro de clientes (siempre rol cliente) | authController.registrar | Prueba "aunque mande rol duena, la cuenta es de cliente" | Implementado y verificado |
| Verificación de correo obligatoria antes del primer ingreso | authController.verificarCorreo | Login sin verificar → estado verificar_correo; e2e cliente nuevo | Implementado y verificado |
| Login: sin sesión hasta el MFA; desafío temporal de 5 min en cookie HttpOnly | authController.iniciarSesion, sesionModel.crearDesafio | Prueba "el desafío MFA no sirve para rutas protegidas" | Implementado y verificado |
| Elegir canal (solo verificados): correo o SMS | authController.enviarCodigoMfa, MfaPage.jsx | Prueba "SMS solo si el teléfono está verificado"; e2e login por SMS | Implementado y verificado |
| Código con crypto.randomInt, 6 dígitos, 5 min, un uso, 5 intentos, HMAC-SHA256, comparación en tiempo constante | servicios/cripto.js, servicios/codigos.js | 7 pruebas MFA (correcto, incorrecto, vencido, reutilizado, intentos, reenvío, código anterior) + hash | Implementado y verificado |
| Código nuevo anula el anterior; reenvío ≥ 60 s; máximo por hora | servicios/codigos.js | Pruebas de reenvío y código anterior | Implementado y verificado |
| MFA en cada login, sin "recordar dispositivo" | authController | No existe esa opción; cada login crea un desafío nuevo | Implementado y verificado |
| Redirección por rol (cliente, proveedor, ventas, administración, dueña) | DESTINO_POR_ROL, MfaPage.jsx | e2e: /cliente, /proveedor, /pos, /admin, /duena | Implementado y verificado |
| Errores genéricos en login y recuperación | authController | Pruebas "error genérico" y "misma respuesta exista o no el correo" | Implementado y verificado |
| Correo real con Nodemailer (SMTP del .env) | servicios/notificaciones.js | Probado con un servidor SMTP real local (tests/05) | Implementado y verificado |
| Gmail con contraseña de aplicación | README sección 6 | Necesita la cuenta de Daisy | Pendiente de acción del usuario |
| SMS real con Twilio (+506) | servicios/notificaciones.js | Probado contra un servidor que imita la API de Twilio (tests/05) | Implementado, pendiente de prueba local |
| Twilio con la cuenta de Daisy | README sección 7 | Necesita su cuenta; la prueba de Twilio puede rechazar textos propios | Pendiente de acción del usuario |
| Modo consola solo con NODE_ENV=development y MFA_MODO_CONSOLA=true; nunca en producción; no salta el MFA | config/env.js | Prueba "Modo consola: nunca se activa en producción"; e2e escribe cada código | Implementado y verificado |
| Si el envío falla: error claro, nunca "enviado" | servicios/notificaciones.js | Pruebas SMTP con contraseña mala, sin SMTP y Twilio 21608 (503, no se crea la cuenta) | Implementado y verificado |
| Credenciales solo en el .env del backend | backend/.env.example, frontend/.env.example | El frontend solo tiene VITE_API_URL; el ZIP no incluye .env | Implementado y verificado |
| Recuperación de contraseña: enlace de un uso, 15 min; restablecer cierra sesiones | authController.pedirRecuperacion / restablecerContrasena | Prueba de recuperación; e2e cliente del seed | Implementado y verificado |
| Cambiar contraseña pidiendo la actual; cierra las otras sesiones | perfilController.cambiarContrasena | Prueba "Perfil: cambiar la contraseña..." | Implementado y verificado |
| Perfil: canales verificados, cambio de correo y teléfono re-verificando, cerrar sesiones | PerfilPage.jsx, perfilController | Prueba de teléfono y correo; e2e verificación por SMS | Implementado y verificado |
| Cuentas de proveedor y empleado por invitación (enlace de un uso) | usuarioController, InvitacionPage.jsx | Prueba de invitación; e2e 3 invitaciones | Implementado y verificado |
| Primera dueña con `npm run crear-duena` (no imprime la contraseña; no hace nada si existe) | backend/database/crear-duena.js | Ejecutado: crea, verifica el correo y la segunda vez no hace nada | Implementado y verificado |
| Sin contraseñas predeterminadas en código, seed ni documentación | todo el proyecto | Revisión con grep antes del ZIP (ver más abajo) | Implementado y verificado |
| Argon2id (bcrypt 12 si falla en Windows), mínimo 8 caracteres | servicios/contrasenas.js | argon2id probado en Linux | Implementado, pendiente de prueba local |
| Sesiones en MySQL, token al azar en cookie HttpOnly SameSite=Lax (Secure en producción), solo hash en la base | sesionModel.js, middleware/sesion.js | Prueba de logout (cabecera Set-Cookie con HttpOnly y SameSite=Lax) | Implementado y verificado |
| Vencimiento por inactividad (30 min) y absoluto (8 h); logout revoca; desactivar cierra sesiones | sesionModel.js, usuarioController.cambiarEstado | Pruebas de inactividad, desactivación y logout | Implementado y verificado |
| CSRF en POST/PUT/PATCH/DELETE | middleware/csrf.js | Prueba "CSRF: un POST sin token se rechaza" | Implementado y verificado |
| CORS con credentials solo para el origen del .env (y proxy de Vite) | app.js, vite.config.js | Prueba CORS del inventario original; e2e usa el proxy | Implementado y verificado |
| Límite de login por cuenta y por IP con bloqueo temporal; límites de códigos y recuperación | middleware/limites.js, authController | Prueba "tras 5 contraseñas incorrectas la cuenta se bloquea" | Implementado y verificado |
| Autenticación y rol en TODOS los endpoints (incluidos los viejos) | config/permisos.js, middleware/autorizacion.js | Prueba "Sin sesión: TODAS las rutas protegidas responden 401" y 403 por rol | Implementado y verificado |
| Usuario, rol, proveedor y empleado salen de la sesión | controladores | Pruebas de proveedor con id ajeno en el cuerpo y movimiento con id_empleado inventado | Implementado y verificado |
| Administración crea, **edita** y desactiva cuentas de ventas y proveedor | usuarioController (invitar, corregir correo, estado), UsuariosPage.jsx | Pruebas de invitación, corrección de correo (y 403/409 en lo que no le toca); e2e | Implementado y verificado |
| Sin escalada de privilegios | usuarioController | Pruebas de administrador creando admin/dueña y de roles | Implementado y verificado |
| Respuestas sin hashes, códigos, tokens ni secretos | modelos (columnas públicas) | Prueba MFA revisa que no haya "hash"; auditoría sin códigos | Implementado y verificado |
| Auditoría de logins, MFA, contraseñas, cuentas, roles, ventas, devoluciones y configuración | servicios/auditoria.js, AuditoriaPage.jsx | Prueba de auditoría; e2e | Implementado y verificado |
| Helmet | app.js | Cabeceras en todas las respuestas | Implementado y verificado |
| Rutas privadas por rol en React (solo cosmético) | routes/RutaPrivada.jsx | e2e: "no es para su cuenta" para ventas, admin y cliente | Implementado y verificado |
| Ventas en una transacción con FOR UPDATE, 409 sin stock, idempotencia y botón deshabilitado | models/ventaModel.js, PuntoVentaPage.jsx | Pruebas de venta normal, sin stock, clave repetida, simultáneas | Implementado y verificado |
| Precio y costo guardados al vender; ventas no se editan | ventaModel.js, movimientoModel.js | Pruebas de detalle y de movimientos de venta (409) | Implementado y verificado |
| Devoluciones (≤ vendido − devuelto, motivo, 409 si pasa de 67) | ventaModel.registrarDevolucion | 3 pruebas de devolución | Implementado y verificado |
| Reutilizar la lógica de movimientos (sin camino paralelo) | movimientoModel.registrarMovimiento | Ventas, devoluciones y abastecimiento la llaman | Implementado y verificado |
| Solicitudes de abastecimiento (aceptar/rechazar, recibir genera entradas) | abastecimientoModel.js, AbastecimientoPage.jsx, ProveedorPortalPage.jsx | Prueba de abastecimiento; e2e | Implementado y verificado |
| Costos solo para la dueña; ganancias solo con costos reales y aviso | productoController, reporteController | Pruebas de costos y de ganancia vs SQL; e2e aviso | Implementado y verificado |
| Interfaz 1 Bienvenida / 2 Login / 3 Registro / 4 MFA / 5 Recuperación | pages/tienda, pages/auth | e2e (capturas 01, 02) | Implementado y verificado |
| Interfaz 6 Portal cliente (catálogo sin stock exacto, historial propio) | ClientePortalPage, CatalogoPage | e2e (captura 12) | Implementado y verificado |
| Interfaz 7 Portal proveedor | ProveedorPortalPage | e2e (captura 09) | Implementado y verificado |
| Interfaz 8 Punto de venta | PuntoVentaPage, VentasPage | e2e (capturas 05, 07, 14) | Implementado y verificado |
| Interfaz 9 Panel administrativo | PanelAdminPage y páginas de /admin | e2e (captura 08) | Implementado y verificado |
| Interfaz 10 Dashboard ejecutivo con Recharts y filtro de fechas | DashboardDuenaPage, GraficosDashboard | e2e (captura 03) | Implementado y verificado |
| Interfaz 11 Perfil y seguridad | PerfilPage | e2e (captura 11) | Implementado y verificado |
| Responsive, formularios con etiqueta, estados de carga/vacío/error, modales (sin window.confirm), Motion con movimiento reducido, sesión vencida → login | componentes | e2e en 390 px; grep sin window.confirm; MotionConfig reducedMotion="user" | Implementado y verificado |
| Pruebas automáticas con node:test + supertest (`npm test`) | backend/tests/ | 60/60 OK | Implementado y verificado |
| Prueba en navegador del flujo de cada rol | docs/evidencias/e2e_roles.py | 42/42 OK |
| Pantallas originales (CRUD, ficha, filtros, estados) siguen funcionando en el navegador | docs/evidencias/e2e_inventario.py | 155/155 OK con sesión de administrador | Implementado y verificado |
| Lint backend y frontend | eslint.config.js | 0 errores | Implementado y verificado |
| .env.example con todas las variables; scripts migrar, seed, crear-duena, test, dev, start | backend/.env.example, backend/package.json | Revisado | Implementado y verificado |
| README en el orden pedido, endpoints, matriz, dependencias y analogías | README.md, docs/endpoints.md, docs/matriz-de-permisos.md | Revisado | Implementado y verificado |
| ZIP sin node_modules, .env, credenciales ni .git, verificado desde cero | mini-proyecto-1.zip | Descomprimido en carpeta vacía: npm ci, migrar, seed, crear-duena, npm test 81/81, lint y build | Implementado y verificado |
| Productos reales de Desy (12, con sus 29 fotos) | backend/database/productos-desy.json, cargar-productos.js, database/fotos/ | tests/07 (seed los carga, no duplica, stock por movimientos); actualización de una base v2 existente | Implementado y verificado |
| Subcategorías (Crochet > Peluches, Llaveros de crochet, Decoración) | migración 006, categoriaController, CategoriasPage, FiltrosProductos, utils/categorias.js | tests/07 (dos niveles, sin ciclos, 409 al borrar); e2e_fotos (filtro Crochet = 8 productos) | Implementado y verificado |
| Fotos en catálogo, ficha (galería), portada y buscador | TarjetaProducto, GaleriaProducto, FotoProducto, BienvenidaPage, BuscadorCabecera | e2e_fotos 20/20, capturas 16 a 20 | Implementado y verificado |
| Subir, elegir principal y borrar fotos (administración y dueña) | fotoController, servicios/fotos.js (sharp + multer), ModalFotos | tests/07 (WebP sin GPS, 400/413/409, permisos 401/403, CSRF); e2e_fotos | Implementado y verificado |
| Fotos con medidas nunca son la principal | migración 007, models/fotoModel.js (ordenar), fotoController (409), ModalFotos (regla), productos-desy.json (`fotos_medidas`) | tests/07 y e2e_fotos 27/27; actualización de una base con las fotos ya cargadas | Implementado y verificado |
| Pedidos de clientes con productos apartados | migración 008, models/pedidoModel.js, models/apartados.js, pedidoController.js, servicios/avisosPedidos.js, MiPedidoPage, MisPedidos, PedidosPage | tests/08 (10 pruebas) y e2e_pedidos 18/18; actualización de una base del 9 de noviembre | Implementado y verificado |
| Lo apartado no se vende ni se saca a mano | movimientoModel.guardarStock, ventaModel.registrarVenta | tests/08 ("Lo apartado no se puede pedir, vender ni sacar a mano") | Implementado y verificado |
| Vencimiento automático y avisos por correo | pedidoModel.vencerAtrasados, server.js (cada 5 min), avisosPedidos.js | tests/08 (vencer, avisos en el buzón de prueba) | Implementado y verificado; el envío real por Gmail queda pendiente en el equipo de Daisy |
| Precios reales de los productos nuevos | backend/database/productos-desy.json | Hoy son precios de ejemplo | Pendiente de acción del usuario |
| Probar todo en Windows + VS Code + MySQL 8.4 | README | Entorno de prueba: Linux + MySQL 8.0.46 | Implementado, pendiente de prueba local |
| Subir los cambios a GitHub | README sección 15 | Lo hace Daisy | Pendiente de acción del usuario |

## Decisiones tomadas (explicadas simple)

- **Un solo lugar para los permisos** (`backend/src/config/permisos.js`): cada ruta dice qué roles la usan; un middleware la revisa en cada petición y lo que no está en la lista responde 404. La matriz de la documentación se genera desde ese archivo (`npm run matriz`), así nunca quedan distintas.
- **Roles guardados sin ñ** (`duena`) para evitar problemas de codificación; en pantalla dice "Dueña".
- **Toda cuenta interna se vincula a un empleado** (también la dueña), así cada movimiento y venta queda a nombre de una persona real. `crear-duena` puede vincularla a un empleado existente.
- **El empleado de un movimiento sale de la sesión** (antes se elegía en una lista). Es un cambio de la v1 pedido por la regla "nunca desde lo que envía el frontend"; al editar, el movimiento conserva a quien lo registró.
- **Movimientos creados por ventas, devoluciones o abastecimiento no se editan ni borran** (409): así el inventario y las ventas nunca se contradicen.
- **Los vencimientos se comparan en MySQL con NOW()** (no con el reloj de Node) para que no haya diferencias de zona horaria.
- **Modo consola aplica a correos y SMS** (incluye recuperación e invitaciones) para poder probar todo sin servicios externos.
- **Registro con correo existente**: responde igual que uno nuevo y avisa por correo al dueño de esa cuenta.
- **Recuperación con el correo sin configurar**: responde 503 para cualquier correo (se revisa antes de buscar la cuenta, así no delata nada).
- **El SMS usa la API REST de Twilio con fetch** (sin el paquete oficial), una dependencia menos; `TWILIO_API_URL` permite probarlo con un servidor falso.
- **El proxy de Vite** (`/api` → puerto 3000) hace que navegador, cookies y CSRF funcionen sin trucos de CORS en desarrollo.
- **bcryptjs** (no `bcrypt`) como plan B porque no necesita compilar nada en Windows.
- **Pruebas en una base aparte** que se borra y se crea en cada archivo; nunca tocan la base de la tienda.
- **Fotos en una carpeta, no dentro de MySQL**: la base guarda solo el nombre del archivo (como la ficha que dice en qué cajón está algo). La carpeta `backend/uploads` no se sube a GitHub; las fotos iniciales sí (en `backend/database/fotos`) y el seed las copia.
- **Cada foto se vuelve a dibujar como WebP** con `sharp`: así pesa poco (unos 25 KB), se ve igual en todos los navegadores y pierde los datos ocultos del celular (GPS). El nombre lo inventa el servidor.
- **Solo dos niveles de categorías** (principal y subcategoría): alcanza para Crochet > Peluches y mantiene simples los filtros. Elegir "Crochet" en los filtros incluye sus subcategorías.
- **Productos nuevos por nombre, no por ID**: `productos-desy.json` busca categorías, materiales y proveedores por nombre, así funciona igual en una base nueva y en la que Daisy ya tiene. Si un código ya existe, no se toca (respeta los cambios hechos en la aplicación). El stock inicial entra como un movimiento real.
- **Al crear un producto se abre la ventana de fotos**, para no olvidar agregarlas.
- **Apartar sin tocar el stock:** las unidades de un pedido se restan de lo *disponible*, no de `productos.stock`. Así el stock sigue cambiando solo con movimientos (regla de la versión 1) y un pedido vencido o rechazado se "libera" solo, sin movimientos de ida y vuelta. La salida real ocurre al entregar, con la venta.
- **El vencimiento se calcula en la consulta** (`vence_en > NOW()`), no depende de que corra la revisión: si el servidor estuvo apagado, lo vencido igual deja de apartar. La revisión cada 5 minutos solo cambia el estado y envía el aviso.
- **Se cobra el precio del pedido**, para respetar lo que vio el cliente al pedir.
- **Fotos con medidas como una marca de la foto** (no como un orden manual): así la regla "nunca de primera" la cumple el backend siempre, aunque se suban, borren o reordenen fotos después. Las tarjetas usan solo fotos normales; si no hay ninguna, se ve el ícono.
- **El antiguo `npm run probar-api`** se reemplazó por `npm test` (sus 135 comprobaciones están dentro, ahora con sesión y CSRF).

---

## Anexo · Checklist de la versión 1

Estados posibles:

- **Implementado y verificado**: se probó de verdad en el entorno de desarrollo (MySQL 8.0.46 real, Node 22, Chromium). Ver [pruebas.md](pruebas.md).
- **Implementado, pendiente de prueba local**: está hecho, pero falta confirmarlo en el equipo de Daisy (Windows).
- **Pendiente de acción del usuario**: lo tiene que hacer Daisy.

### Decisiones tomadas (y contradicciones entre el PDF y el prompt)

| Tema | PDF | Prompt | Decisión |
|---|---|---|---|
| Base de datos | A elección (MySQL, PostgreSQL, MongoDB, SQLite...) | MySQL 8, sin MariaDB ni XAMPP | MySQL 8 (se sigue el prompt) |
| Número de entidades | Mínimo 3 con al menos una relación | Mínimo 6 tablas con FK | 6 tablas relacionadas (cumple ambos) |
| Alcance del CRUD (Día 1) | Al menos crear y listar de una entidad | CRUD completo de todas | CRUD completo de las 6 (cumple ambos) |
| Respuesta de DELETE | 200 o 204 | 200 con confirmación en JSON | 200 con `{ message, id }` |
| Prueba de los endpoints | "Con Postman, Thunder Client o similar" | Desde los formularios; no hace falta colección de Postman | Se prueban desde los formularios **y** se incluye `npm run probar-api` (script de 135 pruebas) como el "similar" que menciona el PDF |
| Versión de MySQL en Windows | — | MySQL 8 Community Server | Se recomienda **8.4 LTS** porque la serie 8.0 dejó de recibir actualizaciones en abril de 2026. El código usa solo funciones que existen en 8.0 y 8.4 |

Decisiones de rutina (la opción más sencilla):

- Módulos ES (`import`/`export`) en backend y frontend, para usar la misma sintaxis en todo el proyecto.
- `src/server.js` arranca el servidor y `src/app.js` solo configura Express (el PDF pide `app.js` como configuración).
- Se agregaron `src/config/env.js` (lee el `.env` en un solo lugar), `src/routes/index.js` (reúne las rutas), `src/utils/formato.js` (formato de precios y fechas) y `backend/pruebas/probar-api.js`.
- El máximo de stock (67) **no** se repite en un CHECK de MySQL, para que exista en un solo lugar (`STOCK_MAXIMO`). MySQL solo protege el mínimo (`stock >= 0`).
- El seed inserta los productos con stock 0 y aplica los movimientos de `db.json` con las mismas reglas que la API. Así el stock inicial siempre coincide con sus movimientos, incluso si se vuelve a ejecutar después de borrar algo.
- La API rechaza con 400 un `stock` enviado en `POST`/`PUT /api/productos` (en vez de ignorarlo en silencio).
- Endpoints extra: `GET /api/configuracion` (el frontend obtiene el 67) y `GET /api/salud` (comprobar API y MySQL).
- Los textos se comparan sin distinguir mayúsculas ni tildes (`utf8mb4_0900_ai_ci`): "Aretes" y "aretes" son duplicados.
- La validación la hace el backend; el formulario usa `noValidate` para que siempre se vean los mensajes reales de la API.
- dotenv se fijó en la línea 16 (la más documentada).
- Formulario arriba y tabla debajo a todo el ancho, porque lado a lado la tabla de movimientos quedaba cortada.
- **Nombre de la empresa: Desy** (logo, menú, pie de página, título de la pestaña y documentación).
- **Paleta de colores del logo de Desy** (pedido de Daisy): fondo crema `#faf7f2`, café oscuro `#4a2f1d` para títulos, botones y pie, verde hoja `#3e7a2e` para precios y enlaces, y amarillo `#ffe27a` de acento. Se midió el contraste de cada combinación de texto (todas pasan 4.5:1; el texto secundario, 6.2:1). El verde de las barras del gráfico (`#5a9a3c`) pasó el validador de daltonismo y contraste. Los colores están en variables al inicio de `index.css`.
- **Logo de Desy** (enviado por Daisy): se le quitó el fondo blanco y se recortaron los márgenes (`frontend/src/assets/logo-desy.png`). Va en la cabecera, el menú lateral y el pie (ahí sobre una tarjeta blanca, para que el café y el verde se vean bien sobre el azul). La flor del logo es el ícono de la pestaña (`public/favicon.png` y `public/apple-touch-icon.png`). La palabra "inventario" junto al logo usa el café y el verde del logo.
- **Diseño estilo tienda en línea**, a partir de la captura y el video que envió Daisy: cabecera con menú ☰ y buscador grande, títulos tipo ruta, tarjeta "Filtros" con secciones desplegables, "Ordenar por", productos en tarjetas, ficha de producto, carrusel, filas deslizables y pie azul marino. Se copió el estilo, no el nombre, el logo ni las imágenes de esa tienda.
- Lo que el enunciado no permite se reemplazó: "Iniciar sesión" y "Carrito" → accesos a Movimientos y Resumen; "Cantidad + Agregar al carrito" → "Cantidad + Registrar entrada / Registrar salida" (crean un movimiento real); no hay pagos, suscripción ni búsqueda por foto.
- Como no se guardan fotos, cada producto muestra un ícono según su categoría sobre un fondo de color (`components/IconoCategoria.jsx`).
- En Productos, la "tabla o lista para consultar" es la cuadrícula de tarjetas, y el formulario de crear/editar se abre en un modal (`components/Modal.jsx`, que también usan la confirmación y el menú lateral).
- Búsqueda, filtros y orden del catálogo se calculan en el navegador sobre la lista que devuelve `GET /api/productos` (son pocos productos; no hacen falta endpoints nuevos).
- Letra: Century Gothic si el equipo la tiene; si no, Urbanist, incluida por npm (`@fontsource-variable/urbanist`), sin descargar nada de internet al usar la app.
- Puerto del frontend fijo (5173, `strictPort`) para que siempre coincida con `CORS_ORIGIN`.

### Requisitos del PDF (Día 1)

| Requisito | Archivo o funcionalidad | Evidencia | Estado |
|---|---|---|---|
| Tema empresarial con justificación | `docs/tema-y-justificacion.md` | Documento con problema, solución, usuarios y alcance | Implementado y verificado |
| Modelar entidades, atributos, tipos y relaciones | `docs/diagrama-completo.md`, `docs/diccionario-de-datos.md`, `script.sql` | Diagramas renderizados con Mermaid CLI; script ejecutado en MySQL 8 | Implementado y verificado |
| Diagrama entidad-relación con atributos y relaciones | `docs/diagrama-completo.md` (y el simple en `docs/diagrama-simple.md`) | Ambos generan imagen sin errores | Implementado y verificado |
| Estructura base con carpetas backend y frontend | `backend/`, `frontend/` | Estructura revisada | Implementado y verificado |
| Servidor Node.js funcionando | `backend/src/server.js` | `npm run dev` → "API escuchando... Conectado a MySQL" | Implementado y verificado |
| Endpoints de crear y listar (mínimo) | Las 6 entidades tienen los 5 endpoints | `npm run probar-api`: 135/135 | Implementado y verificado |
| API REST que responde JSON | `app.js`, controladores, `middleware/errores.js` | Todas las respuestas, incluidos errores y 404, en JSON | Implementado y verificado |
| Front end en React con formularios, tabla y eliminar con confirmación | `frontend/src/pages/*`, `components/ModalConfirmacion.jsx` | Prueba en navegador: 153/153 | Implementado y verificado |
| Mínimo 3 entidades con al menos una relación | 6 tablas y 5 llaves foráneas | `information_schema.REFERENTIAL_CONSTRAINTS` | Implementado y verificado |
| Validaciones de obligatorios y tipos en el backend | `middleware/validaciones.js` y cada controlador | Casos 400 en el script de la API | Implementado y verificado |
| Sin autenticación | No hay login, tokens ni roles en ningún archivo | Revisión del código | Implementado y verificado |
| Endpoints probados con Postman, Thunder Client o similar | `npm run probar-api` | 135 pruebas correctas | Implementado y verificado |
| Repositorio con la estructura creada | README sección 14 | — | Pendiente de acción del usuario (crear el repo y hacer `git push`) |

### Requisitos del prompt

### Forma de trabajo y calidad

| Requisito | Archivo o funcionalidad | Evidencia | Estado |
|---|---|---|---|
| Trabajo por etapas, probando cada una | `docs/pruebas.md` | Una sección por etapa con comandos y resultados | Implementado y verificado |
| Sin pseudocódigo, TODOs ni funciones vacías | Todo el código | Búsqueda de `TODO`/`FIXME` sin resultados | Implementado y verificado |
| Linter sin errores en backend y frontend | `eslint.config.js` en ambas carpetas | `npm run lint`: 0 errores, 0 advertencias en las dos | Implementado y verificado |
| Sin imports sin usar ni nombres inconsistentes | ESLint con `no-unused-vars` y `react/jsx-uses-vars`; revisión cruzada de nombres | Script que compara script.sql, db.json, diagramas, diccionario, backend y frontend: sin diferencias | Implementado y verificado |

### Tema, alcance y nivel

| Requisito | Archivo o funcionalidad | Evidencia | Estado |
|---|---|---|---|
| Tema "Inventario de bisutería y accesorios" | `docs/tema-y-justificacion.md` | — | Implementado y verificado |
| Mínimo 6 tablas coherentes, cada una con razón de negocio | categorias, proveedores, materiales, empleados, productos, movimientos | Justificación de cada tabla en `script.sql` y `tema-y-justificacion.md` | Implementado y verificado |
| CRUD completo de todas las entidades | 6 modelos, 6 controladores, 6 rutas, 6 páginas | API 135/135 y navegador 153/153 | Implementado y verificado |
| Sin autenticación, pagos ni servicios externos | — | Revisión del código | Implementado y verificado |
| JavaScript (no TypeScript), hooks sencillos, SQL directo, sin ORM ni Redux | Todo el código | Solo `useState`, `useEffect`, `useRef`; consultas con `mysql2/promise` | Implementado y verificado |
| Nombres en español y comentarios en las partes importantes | Todo el código | Revisión | Implementado y verificado |

### Stack y estructura

| Requisito | Archivo o funcionalidad | Evidencia | Estado |
|---|---|---|---|
| React + Vite, React Router, Motion, Recharts, lucide-react, react-hot-toast | `frontend/package.json` | `npm ls` y build correcto | Implementado y verificado |
| Express, dotenv, mysql2/promise con pool | `backend/package.json`, `src/config/db.js` | Servidor conectado a MySQL | Implementado y verificado |
| CORS limitado al origen del `.env` (sin `*`) | `src/app.js`, `CORS_ORIGIN` | Encabezado `Access-Control-Allow-Origin: http://localhost:5173` | Implementado y verificado |
| Consultas preparadas con `?` | Todos los modelos y el seed | Revisión: ningún valor del usuario se concatena en SQL | Implementado y verificado |
| MySQL 8 (no MariaDB, XAMPP ni SQLite) | — | Probado con MySQL Community Server 8.0.46 | Implementado y verificado |
| Funciona en MySQL 8.4 LTS en Windows | — | No se pudo descargar 8.4 en el entorno de prueba | Implementado, pendiente de prueba local |
| `script.sql` crea BD, tablas, llaves, restricciones e índices | `backend/database/script.sql` | Ejecutado dos veces sin error | Implementado y verificado |
| `db.json` con datos de TODAS las tablas | `backend/database/db.json` | 6 tablas con datos | Implementado y verificado |
| Estructura de carpetas obligatoria completa | Ver README | Revisión archivo por archivo | Implementado y verificado |
| Flujo index.html → main.jsx → App.jsx → routes → pages → components | `index.html`, `main.jsx`, `App.jsx`, `routes/AppRoutes.jsx` | Revisión de los imports | Implementado y verificado |
| Todas las llamadas HTTP en services | `src/services/*` | Ninguna página ni componente usa `fetch` ni la URL de la API (revisión automática) | Implementado y verificado |
| Versiones anotadas en el README | README sección 1 | — | Implementado y verificado |

### Modelo de datos

| Requisito | Archivo o funcionalidad | Evidencia | Estado |
|---|---|---|---|
| PK, FK, obligatorios, unicidad, cardinalidades, reglas de eliminación | `diccionario-de-datos.md`, `script.sql` | Pruebas de UNIQUE, CHECK y FK en MySQL | Implementado y verificado |
| Diagrama simple (solo tablas, PK, FK y líneas) | `docs/diagrama-simple.md` | Renderizado | Implementado y verificado |
| Diagrama completo con todos los atributos | `docs/diagrama-completo.md` | Renderizado | Implementado y verificado |
| Nombres idénticos en diagramas, SQL, db.json, backend y frontend | — | Revisión automática sin diferencias | Implementado y verificado |
| Sin cascada; 409 si hay dependencias | FK con `RESTRICT`; conteo previo en cada controlador | 5 casos 409 en el script y en el navegador | Implementado y verificado |

### Stock

| Requisito | Archivo o funcionalidad | Evidencia | Estado |
|---|---|---|---|
| Stock solo en `productos`, única fuente de verdad | `productos.stock` | — | Implementado y verificado |
| Mínimo 0 y máximo 67 | `config/constantes.js`, `movimientoModel.js` | Casos 409 de entrada > 67 y salida < 0 | Implementado y verificado |
| 67 en una sola constante | `STOCK_MAXIMO` en `backend/src/config/constantes.js` | Búsqueda del número 67 en el código: solo ahí (y en comentarios) | Implementado y verificado |
| El frontend obtiene el límite de la API | `GET /api/configuracion` → `configuracionService.js` | El panel y el aviso muestran 67 sin tenerlo escrito | Implementado y verificado |
| El stock no se edita en el formulario de productos | `ProductosPage.jsx` sin campo de stock; API responde 400 | Prueba en API y navegador | Implementado y verificado |
| Entrada suma, salida resta | `movimientoModel.crear` | 0 → 60 → 35 en el script | Implementado y verificado |
| Editar revierte y aplica | `movimientoModel.actualizar` | 35 → 30 → 65, y cambio de producto | Implementado y verificado |
| Eliminar revierte | `movimientoModel.eliminar` | 65 → 5; navegador 40 → 60 | Implementado y verificado |
| 409 con mensaje claro fuera de rango | `verificarRango` | "La entrada supera el stock máximo de 67 unidades..." | Implementado y verificado |
| Transacción en operaciones de más de una tabla | `enTransaccion` en `movimientoModel.js`; seed | Rechazo en el segundo producto no cambia ninguno; ROLLBACK del seed probado | Implementado y verificado |
| db.json coherente (0 a 67, stock = movimientos) | `db.json` + seed | Stocks finales entre 0 y 65 | Implementado y verificado |
| Reglas documentadas | README sección 12 y `diccionario-de-datos.md` | — | Implementado y verificado |

### Endpoints, validaciones y errores

| Requisito | Archivo o funcionalidad | Evidencia | Estado |
|---|---|---|---|
| 5 endpoints por entidad con 201/200/404 | Rutas y controladores | Script de la API | Implementado y verificado |
| Listado vacío = arreglo vacío | Modelos `listar` | BD vacía: 6 respuestas `[]` | Implementado y verificado |
| PUT sin cambios = 200 (no 404) | Se busca el registro antes de actualizar | 6 casos en el script | Implementado y verificado |
| Formato único `{ "message": ... }` | `middleware/errores.js` | El script verifica que cada error tenga solo `message` | Implementado y verificado |
| 400 / 404 / 409 / 500 correctos | Controladores y middleware | Script de la API; prueba de 500 con MySQL apagado y error inesperado | Implementado y verificado |
| 500 sin SQL, credenciales ni detalles | `manejadorErrores` | Mini app que lanza un error con SQL y contraseña: la respuesta no los muestra | Implementado y verificado |
| Validar obligatorios, espacios, longitudes, tipos, IDs, rangos, fechas, FK, unicidad | `middleware/validaciones.js` | Casos 400/409 del script | Implementado y verificado |
| try/catch en controladores y middleware centralizado | Todos los controladores | Revisión | Implementado y verificado |
| JSON en ruta inexistente y JSON malformado | `rutaNoEncontrada`, `manejadorErrores` | Casos en el script | Implementado y verificado |
| Credenciales solo en el backend | `backend/.env`; `frontend/.env` solo tiene `VITE_API_URL` | Revisión | Implementado y verificado |

### Seed

| Requisito | Archivo o funcionalidad | Evidencia | Estado |
|---|---|---|---|
| `npm run seed` lee db.json e inserta en orden de FK | `database/seed.js` | Resumen del seed | Implementado y verificado |
| Consultas preparadas y transacción con rollback | `seed.js` | Prueba de rollback | Implementado y verificado |
| IDs fijos y repetible sin duplicar | `seed.js` revisa el ID antes de insertar | Segunda ejecución: 0 insertados | Implementado y verificado |
| No borra ni sobrescribe lo editado; recrea lo borrado | `seed.js` | Pruebas de la etapa 2 | Implementado y verificado |
| Resumen claro y cierre de conexiones | `mostrarResumen`, `pool.end()` | El proceso termina solo | Implementado y verificado |
| Datos ficticios y suficientes | `db.json` (correos `example.com`) | Se ven todas las entidades y el gráfico | Implementado y verificado |

### Frontend

| Requisito | Archivo o funcionalidad | Evidencia | Estado |
|---|---|---|---|
| Una página por entidad en el menú | `Layout.jsx`, `AppRoutes.jsx` | Recorrido de las 8 páginas | Implementado y verificado |
| Formulario crear/editar, tabla, editar y eliminar | Cada página | Navegador 153/153 | Implementado y verificado |
| Modal de confirmación (sin `window.confirm`), cancelable, Escape y foco | `ModalConfirmacion.jsx` | Foco en Cancelar, Tab atrapado, Escape y Cancelar | Implementado y verificado |
| Mensajes de éxito y error del backend visibles | Toasts y `.alerta-error` | Duplicados, validaciones, stock máximo, dependencias | Implementado y verificado |
| Selectores con nombres (nunca escribir IDs) | `CampoFormulario` tipo `select` | Prueba en navegador | Implementado y verificado |
| Estados cargando, sin registros, error de conexión, guardando, eliminando | `EstadoLista.jsx`, `Boton.jsx` | Probados (backend apagado de verdad para el error de conexión) | Implementado y verificado |
| Botones deshabilitados durante peticiones | `ocupado`, `cargando` | Prueba con respuesta retrasada | Implementado y verificado |
| Actualizar sin recargar y conservar datos si hay error | `recargarLista`, el formulario solo se limpia si se guardó | Prueba en navegador | Implementado y verificado |
| Movimientos muestra stock actual y máximo (67) | `.panel-stock` en `MovimientosPage.jsx` | Prueba en navegador | Implementado y verificado |
| Animaciones Motion en página, filas, modal y botones | `PaginaAnimada`, `TablaDatos`, `ModalConfirmacion`, `Boton` | Medición de opacidad y transform | Implementado y verificado |
| Respeta movimiento reducido | `MotionConfig reducedMotion="user"`, CSS `prefers-reduced-motion`, gráfico sin animación | Prueba con `reduced_motion='reduce'` | Implementado y verificado |
| Íconos lucide-react y toasts | En todas las páginas | Capturas | Implementado y verificado |
| Gráfico Recharts con datos reales y línea del máximo | `GraficoStock.jsx` en Inicio | Barras = productos de la API; la barra de un producto nuevo aparece | Implementado y verificado |
| Interfaz en español, estilo empresarial, adaptable | `index.css` | Capturas en 1440 px y 390 px sin desbordes; en celular, dos tarjetas por fila y filtros plegables | Implementado y verificado |
| Paleta de colores del logo | `src/index.css` (bloque `:root`), `utils/fondosCategoria.js`, anuncios en `InicioPage.jsx` | Contraste medido de cada texto; validador del color del gráfico; capturas de Inicio, Productos y Ficha; 153/153 en el navegador | Implementado y verificado |
| Nombre y logo de la empresa Desy | `Layout.jsx`, `PiePagina.jsx`, `index.html`, `src/assets/logo-desy.png`, `public/favicon.png`, docs | Prueba: la imagen del logo carga en la cabecera y el pie, el ícono de la pestaña es la flor y la pestaña dice "Desy · Inventario" | Implementado y verificado |
| Diseño estilo tienda (captura y video de referencia) | `Layout.jsx`, `BuscadorCabecera.jsx`, `FiltrosProductos.jsx`, `TarjetaProducto.jsx`, `ProductoDetallePage.jsx`, `CarruselAnuncios.jsx`, `FilaDeslizable.jsx`, `PiePagina.jsx` | Capturas comparadas con la referencia; 153 pruebas en el navegador | Implementado y verificado |
| Buscador con sugerencias y página de resultados | `BuscadorCabecera.jsx`, `ProductosPage.jsx` (`?buscar=`) | "pul" muestra 2 sugerencias; Enter muestra "Resultados de búsqueda para: 'pul'" | Implementado y verificado |
| Filtros y "Ordenar por" en el catálogo | `FiltrosProductos.jsx`, `SeccionFiltro.jsx`, `SelectorOrden.jsx` | Categoría, disponibilidad, precio, aviso amarillo sin resultados, orden por precio y stock | Implementado y verificado |
| Ficha de producto con entrada y salida | `ProductoDetallePage.jsx` (`/productos/:id`) | Entrada de 3 y salida de 3 cambian el stock; 400 sin empleado; 409 al pasar de 67; producto inexistente | Implementado y verificado |

### Entorno, documentación, Git y entrega

| Requisito | Archivo o funcionalidad | Evidencia | Estado |
|---|---|---|---|
| `.env.example` de backend (puerto, MySQL, CORS) y frontend (`VITE_API_URL`) | `backend/.env.example`, `frontend/.env.example` | — | Implementado y verificado |
| Scripts npm: iniciar backend y frontend, seed, build | `package.json` de cada carpeta | Todos ejecutados | Implementado y verificado |
| `package-lock.json` generados por npm | Ambas carpetas | Creados por `npm install` | Implementado y verificado |
| README con las 15 secciones en orden, carpeta de cada comando | `README.md` | Revisión | Implementado y verificado |
| Instalar MySQL 8 en Windows y comprobarlo | README sección 3 | — | Pendiente de acción del usuario |
| Ejecutar todo en Windows con VS Code | README secciones 4 a 10 | — | Implementado, pendiente de prueba local |
| Recorrido de una operación y analogías | README, final | — | Implementado y verificado |
| `.gitignore` con lo mínimo pedido | `.gitignore` | Contiene `node_modules/`, `.env`, `.env.*`, `!.env.example`, `dist/`, `*.log` | Implementado y verificado |
| Comandos de Git y cómo crear el repositorio | README sección 14 | — | Implementado y verificado |
| Subir a GitHub | — | No se publicó ni se inventó una URL | Pendiente de acción del usuario |
| ZIP con raíz `mini-proyecto-1/`, sin `node_modules`, `.env`, credenciales ni `.git` | `mini-proyecto-1.zip` | Listado del ZIP revisado | Implementado y verificado |
