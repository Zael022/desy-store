# Registro de pruebas

Entorno donde se hicieron las pruebas (entorno de desarrollo de Claude):

- Ubuntu 24.04 (Linux), Node.js 22.23.4, npm 10.9.9.
- **MySQL Community Server 8.0.46** (paquete oficial `mysql-server-8.0` de Ubuntu; no MariaDB, no XAMPP, no SQLite).
- Navegador automatizado: Chromium con Playwright.

Cada sección dice qué se ejecutó, qué resultado dio y qué queda pendiente de probar en el equipo de Daisy (Windows + VS Code).

## Etapa 1 · Modelo de datos, script.sql y diagramas

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

## Etapa 2 · Conexión a MySQL y seed

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

## Etapas 3 y 4 · Backend (CRUDs, validaciones, errores) y lógica del stock

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

## Etapas 5 y 6 · Frontend, animaciones, gráfico, íconos y notificaciones

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

## Etapas 7 y 8 · Documentación, revisión final y ZIP

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Nombres consistentes | Script que compara tablas y campos de `script.sql` con `db.json`, ambos diagramas, el diccionario, el backend y el frontend; rutas del frontend contra las del backend; búsqueda de `fetch`/URL en páginas y componentes; búsqueda del número 67 | OK: sin diferencias; el 67 solo está en `constantes.js` (y en comentarios); ninguna página ni componente llama a la API directamente |
| Restos sin usar | Búsqueda de `TODO`, `FIXME` y `console.log` sueltos; revisión de archivos de la plantilla de Vite | OK. Se borraron `frontend/.oxlintrc.json` y un `.gitignore` duplicado que venían de la plantilla |
| Comando de Windows para crear la BD | `mysql -u root -p -e "source database/script.sql"` (funciona en PowerShell y CMD) | OK en MySQL 8.0.46 |
| ZIP sin contenido prohibido | `unzip -l` del ZIP | OK: no tiene `node_modules`, `.env`, `dist`, `.git` ni `.log`; la carpeta raíz es `mini-proyecto-1/` |
| **Instalación desde cero con el ZIP** | Se descomprimió el ZIP en una carpeta nueva, se borró la base de datos y se siguió el README: `script.sql`, copiar `.env.example`, `npm ci` en las dos carpetas, `npm run lint`, `npm run seed` dos veces, `npm run dev`, `npm run build`, `npm run probar-api` | OK: lint sin errores en las dos carpetas, build correcto, seed 5/4/6/3/9/23 y luego todo omitido, **API 135/135** |
| **Navegador contra la copia limpia** | Misma prueba Playwright de las etapas 5 y 6 | OK: **117/117**; al final la base quedó con los datos del seed |

## Pendiente de probar en el equipo de Daisy (Windows + VS Code)

1. Instalar **MySQL 8.4 LTS** y ejecutar `script.sql`. En este entorno no se pudo descargar MySQL 8.4 (solo estaba disponible 8.0.46). El proyecto usa únicamente funciones que existen igual en 8.0 y 8.4 (CHECK, ENUM, `utf8mb4_0900_ai_ci`, autenticación `caching_sha2_password`, que `mysql2` soporta).
2. Seguir el README en Windows: `npm install`, `.env`, `npm run seed`, `npm run dev` en las dos carpetas, y abrir <http://localhost:5173>.
3. Ejecutar `npm run probar-api` (debe decir 135 correctas) y recorrer los formularios como indica el README, sección 11.
4. Crear el repositorio en GitHub y subir el proyecto (README, sección 14).

## Rediseño estilo tienda en línea y nombre "Desy"

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

## Logo de Desy

Daisy envió el logo de la empresa. Se preparó la imagen (fondo blanco → transparente, márgenes recortados, versión cuadrada de la flor para el ícono de la pestaña) y se colocó en la cabecera, el menú lateral y el pie de página.

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Linter y build del frontend | `npm run lint` y `npm run build` | OK, 0 errores y 0 advertencias; el logo se incluye en el build |
| Revisión visual | capturas en 1440 px, 390 px y 360 px | OK: el logo se ve nítido sobre el fondo de la cabecera; en celular el logo, "inventario" y los accesos caben en una fila sin desbordes |
| Prueba del navegador | script Playwright (con tres pruebas nuevas del logo) | **OK: 153/153** |
| API | `npm run probar-api` | OK: 135/135 |

Ajuste hecho al revisar las capturas: en celular el logo con la palabra "inventario" empujaba los accesos a otra línea; se achicó esa palabra en pantallas pequeñas.

## Paleta de colores del logo

Daisy pidió que los colores combinen con el logo. Se cambió el azul por los colores del logo: fondo crema, café oscuro (títulos, botones, pie de página), verde hoja (precios, enlaces, subrayado de pestañas), verde claro y amarillo (acentos como el contador de filtros y el punto activo del carrusel). Los fondos de las tarjetas y los anuncios del carrusel también se pasaron a tonos del logo.

| Prueba | Comando / acción | Resultado |
|---|---|---|
| Contraste de los textos | cálculo de contraste WCAG de cada combinación | OK: texto principal 13.4:1, secundario 6.2:1, precios en verde 5.2:1, botones café con letra blanca 12.2:1, anuncios 4.7:1 o más |
| Color del gráfico | validador de paletas (daltonismo, luminosidad, croma, contraste) con `#5a9a3c` | OK: pasa todas las comprobaciones |
| Restos del color viejo | búsqueda de "azul" y de los colores viejos en el CSS; revisión de que toda variable usada esté definida | OK: no quedó ninguno |
| Linter y build del frontend | `npm run lint`, `npm run build` | OK |
| Prueba del navegador | script Playwright | **OK: 153/153** |
| API | `npm run probar-api` | OK: 135/135 |
