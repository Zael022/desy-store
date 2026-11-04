# Checklist final

Estados posibles:

- **Implementado y verificado**: se probó de verdad en el entorno de desarrollo (MySQL 8.0.46 real, Node 22, Chromium). Ver [pruebas.md](pruebas.md).
- **Implementado, pendiente de prueba local**: está hecho, pero falta confirmarlo en el equipo de Daisy (Windows).
- **Pendiente de acción del usuario**: lo tiene que hacer Daisy.

## Decisiones tomadas (y contradicciones entre el PDF y el prompt)

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

## Requisitos del PDF (Día 1)

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

## Requisitos del prompt

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
