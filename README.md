# Desy · Sistema de inventario para una tienda de bisutería y accesorios

Mini Proyecto 1 · Sistema empresarial con Node.js y React.

Aplicación web para que **Desy**, una tienda de bisutería y accesorios, organice sus **productos, categorías, proveedores, materiales y empleados**, y registre cada **entrada y salida de mercadería**. El stock de cada producto se calcula con esos movimientos y nunca puede bajar de 0 ni pasar de **67 unidades**.

La interfaz usa el **logo de Desy** y sus colores (café, verde y amarillo sobre fondo crema), con estilo de tienda en línea: cabecera con menú ☰ y buscador con sugerencias, catálogo con filtros y "Ordenar por", ficha de cada producto, carrusel de anuncios en el inicio y pie de página. No tiene inicio de sesión, carrito ni pagos (el proyecto no los permite); en la ficha, el lugar del carrito lo ocupan los botones **Registrar entrada** y **Registrar salida**.

- Backend: Node.js + Express, API REST en JSON, MySQL 8 con `mysql2/promise`.
- Frontend: React + Vite, React Router, Motion, Recharts, lucide-react y react-hot-toast.
- Sin inicio de sesión, usuarios, roles ni pagos (no lo pide el proyecto).

Documentación del proyecto (carpeta `docs/`):

| Archivo | Qué contiene |
|---|---|
| [tema-y-justificacion.md](docs/tema-y-justificacion.md) | Problema de la empresa, cómo la ayuda el sistema, usuarios y alcance |
| [diagrama-simple.md](docs/diagrama-simple.md) | Diagrama entidad-relación principal (solo tablas, PK, FK y relaciones) |
| [diagrama-completo.md](docs/diagrama-completo.md) | Diagrama con todos los atributos |
| [diccionario-de-datos.md](docs/diccionario-de-datos.md) | Cada campo con su tipo, llaves y restricciones; reglas del stock |
| [pruebas.md](docs/pruebas.md) | Qué se probó, cómo y con qué resultado |
| [checklist.md](docs/checklist.md) | Cada requisito del PDF y del enunciado, con su evidencia y estado |

---

## 1. Requisitos y versiones usadas

Instale esto en Windows:

| Programa | Versión recomendada | Para qué |
|---|---|---|
| Node.js | **22 LTS o 24 LTS** (mínimo 20.19). Probado con 22.23.4 | Ejecuta el backend de Express y las herramientas del frontend |
| npm | El que viene con Node (probado con 10.9.9) | Instala las librerías |
| MySQL Community Server | **8.4 LTS** (la serie 8.0 dejó de recibir actualizaciones en abril de 2026). Probado con 8.0.46 | Base de datos |
| MySQL Workbench | La versión más reciente (opcional) | Ver y administrar la base de datos con ventanas |
| Visual Studio Code | Cualquiera reciente | Editor |
| Git | Cualquiera reciente | Subir el proyecto a GitHub |

Versiones de las librerías (instaladas con npm, quedan fijadas en cada `package-lock.json`):

| Backend | Versión | Frontend | Versión |
|---|---|---|---|
| express | 5.3.0 | react / react-dom | 19.3.1 |
| mysql2 | 3.24.6 | vite | 8.3.5 |
| dotenv | 16.6.1 | @vitejs/plugin-react | 6.2.1 |
| cors | 2.8.6 | react-router | 8.5.1 |
| eslint | 9.39.5 | motion (Framer Motion) | 14.9.1 |
| | | recharts | 3.10.1 |
| | | lucide-react | 1.68.0 |
| | | react-hot-toast | 2.6.1 |
| | | @fontsource-variable/urbanist (letra incluida en el proyecto) | 5.3.0 |
| | | eslint + plugins de React | 9.39.5 |

## 2. Abrir el proyecto en Visual Studio Code

1. Descomprima el ZIP. Quedará una carpeta `mini-proyecto-1`.
2. Abra VS Code → **File → Open Folder...** → elija la carpeta `mini-proyecto-1` (la que contiene `backend`, `frontend` y `docs`).
3. Abra una terminal: **Terminal → New Terminal**. Va a necesitar **dos terminales**: una para el backend y otra para el frontend. Con el botón **+** de la terminal se abre otra.

Estructura:

```
mini-proyecto-1/
  backend/     API REST (Express + MySQL)
  frontend/    Interfaz (React + Vite)
  docs/        Documentación y diagramas
  README.md
  .gitignore
```

## 3. Instalar MySQL 8 y comprobar que funciona

1. Entre a <https://dev.mysql.com/downloads/mysql/>.
2. En **Select Version** elija la versión **8.4.x LTS** y en **Select Operating System**, **Microsoft Windows**.
3. Descargue **Windows (x86, 64-bit), MSI Installer**. Si le pide iniciar sesión, haga clic en **"No thanks, just start my download"**.
4. Ejecute el archivo `.msi` → **Next** → elija **Typical** → **Install**. Al final deje marcada la opción para abrir **MySQL Configurator** y presione **Finish**.
5. En **MySQL Configurator**:
   - *Type and Networking*: **Development Computer**, puerto **3306**.
   - *Accounts and Roles*: escriba una **contraseña para root** y **anótela** (la va a necesitar en el `.env`).
   - *Windows Service*: deje marcado **Start the MySQL Server at System Startup**.
   - Presione **Next** hasta **Execute** y luego **Finish**.
6. (Opcional) Instale MySQL Workbench desde <https://dev.mysql.com/downloads/workbench/>.

**Comprobar que MySQL funciona** (cualquiera de estas):

- Menú Inicio → busque **MySQL 8.4 Command Line Client** → escriba la contraseña de root → escriba `SELECT VERSION();` y presione Enter. Debe responder algo como `8.4.x`.
- Menú Inicio → **Servicios** → busque **MySQL84**: debe decir **En ejecución**.
- En Workbench: haga doble clic en la conexión local que aparece en la pantalla de inicio (puerto 3306, usuario root) e ingrese la contraseña. Si no aparece, créela con el botón **+**: host `localhost`, puerto `3306`, usuario `root`.

**Para usar `mysql` desde la terminal de VS Code** agregue su carpeta al PATH: menú Inicio → "Editar las variables de entorno del sistema" → **Variables de entorno** → en *Path* (de su usuario) → **Nuevo** → `C:\Program Files\MySQL\MySQL Server 8.4\bin` → Aceptar. Cierre y vuelva a abrir VS Code. Compruebe con:

```
mysql --version
```

## 4. Instalar las dependencias

Terminal 1, **desde la carpeta `backend`**:

```
cd backend
npm install
```

Terminal 2, **desde la carpeta `frontend`**:

```
cd frontend
npm install
```

`npm install` lee el `package-lock.json` e instala exactamente las mismas versiones con las que se probó el proyecto.

## 5. Crear la base de datos y las tablas

El archivo `backend/database/script.sql` crea la base `inventario_bisuteria` con sus 6 tablas, llaves, restricciones e índices. Elija **una** opción:

**Opción A · MySQL Workbench:** abra su conexión → **File → Open SQL Script...** → elija `backend/database/script.sql` → presione el **rayo** ⚡ (Execute). Actualice el panel *Schemas* y verá `inventario_bisuteria`.

**Opción B · Terminal de VS Code**, **desde la carpeta `backend`** (funciona en PowerShell y en CMD):

```
mysql -u root -p -e "source database/script.sql"
```

Escriba la contraseña de root. Para comprobar:

```
mysql -u root -p -e "SHOW TABLES FROM inventario_bisuteria;"
```

Debe mostrar: `categorias`, `empleados`, `materiales`, `movimientos`, `productos`, `proveedores`.

El script se puede ejecutar varias veces sin borrar datos. Si quiere **empezar de cero**: `mysql -u root -p -e "DROP DATABASE inventario_bisuteria;"` y vuelva a ejecutar el script.

## 6. Configurar las variables de entorno

**Backend** (desde la carpeta `backend`): copie el ejemplo y edítelo.

```
copy .env.example .env
```

Abra `backend/.env` en VS Code y cambie la contraseña:

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD="la_contraseña_de_root_que_anotó"
DB_NAME=inventario_bisuteria
CORS_ORIGIN=http://localhost:5173
```

- Ponga la contraseña **entre comillas**: si tiene el símbolo `#`, sin comillas se corta.
- `CORS_ORIGIN` es la única dirección que puede usar la API desde el navegador (la del frontend). No se usa `*`.

**Frontend** (desde la carpeta `frontend`):

```
copy .env.example .env
```

Contiene solo `VITE_API_URL=http://localhost:3000/api`. El frontend **no** guarda contraseñas: todo lo que empieza con `VITE_` se puede ver desde el navegador.

> Los archivos `.env` no se suben a GitHub (están en `.gitignore`). Solo se suben los `.env.example`.

## 7. Ejecutar el seed (datos iniciales)

**Desde la carpeta `backend`**:

```
npm run seed
```

Lee `backend/database/db.json` y carga 5 categorías, 4 proveedores, 6 materiales, 3 empleados, 9 productos y 23 movimientos. Al final muestra un resumen y el stock de cada producto.

- Se puede ejecutar **muchas veces**: si un registro ya existe (mismo ID), lo omite. No duplica, no borra y no sobrescribe lo que usted haya editado.
- Si usted borró un registro inicial, lo vuelve a crear.
- Todo va en una **transacción**: si una inserción falla, no se guarda nada.
- Los productos se insertan con stock 0 y el stock sale de aplicar sus movimientos (las mismas reglas de la aplicación).

## 8. Iniciar el backend

**Desde la carpeta `backend`**:

```
npm run dev
```

Debe ver:

```
API escuchando en http://localhost:3000/api
Origen permitido (CORS): http://localhost:5173
Conectado a MySQL (base de datos "inventario_bisuteria").
```

`npm run dev` reinicia el servidor solo cuando usted guarda un cambio. También existe `npm start` (sin reinicio automático). Deje esta terminal abierta.

## 9. Iniciar el frontend

En la **otra terminal**, **desde la carpeta `frontend`**:

```
npm run dev
```

Vite muestra `Local: http://localhost:5173/`. Deje esta terminal abierta también.

## 10. Direcciones para abrir en el navegador

| Dirección | Qué es |
|---|---|
| <http://localhost:5173> | La aplicación (frontend) |
| <http://localhost:5173/productos/1> | Ejemplo de la ficha de un producto |
| <http://localhost:3000/api/salud> | Comprueba que la API y MySQL funcionan |
| <http://localhost:3000/api/productos> | Ejemplo de la API respondiendo JSON |
| <http://localhost:3000/api/configuracion> | El stock máximo que usa el frontend |

Endpoints de cada entidad (`categorias`, `proveedores`, `materiales`, `empleados`, `productos`, `movimientos`):

| Método | Ruta | Respuesta |
|---|---|---|
| POST | `/api/<entidad>` | 201 con el registro creado |
| GET | `/api/<entidad>` | 200 con un arreglo (vacío si no hay registros) |
| GET | `/api/<entidad>/:id` | 200 con el registro, o 404 |
| PUT | `/api/<entidad>/:id` | 200 con el registro actualizado |
| DELETE | `/api/<entidad>/:id` | 200 con `{ "message": "...", "id": ... }` |

Errores, siempre en el formato `{ "message": "texto" }`: **400** datos o ID inválidos o llave foránea inexistente · **404** no existe · **409** duplicado, registro con dependencias o regla del stock · **500** error inesperado (sin detalles internos).

## 11. Cómo probar cada CRUD desde los formularios

**Menú:** el botón ☰ de la cabecera abre el menú con todas las páginas (se cierra con la X, con Escape o con clic afuera). El buscador de la cabecera sugiere productos mientras escribe; con Enter muestra todos los resultados.

En Categorías, Proveedores, Materiales, Empleados y Movimientos: el formulario de arriba sirve para **crear** y, al presionar el lápiz ✏️ de una fila, para **editar**. La papelera 🗑️ abre un **modal de confirmación** (se cancela con el botón, con Escape o con clic afuera). Los mensajes de éxito y de error aparecen arriba a la derecha y, si es un error al guardar, también dentro del formulario (que conserva lo que usted escribió).

| Página | Pruebe crear y editar | Pruebe estos errores |
|---|---|---|
| Categorías | "Tobilleras" | Repetir "aretes" (409), nombre solo con espacios (400), eliminar "Aretes" que tiene productos (409) |
| Proveedores | Nombre + teléfono `2661-1234` | Teléfono con letras (400), correo sin @ (400), nombre repetido (409) |
| Materiales | "Cuarzo" marcando o no hipoalergénico | Nombre repetido "Resina" (409) |
| Empleados | Nombre, puesto y correo | Correo de otra persona, por ejemplo `mariana.solis@example.com` (409); eliminar a Mariana, que tiene movimientos (409) |
| Productos (catálogo) | Botón **Nuevo producto** → se abre el formulario en un modal: código `ARE-003`, precio, nombre y los tres selectores. Para editar o eliminar, use los botones redondos ✏️ 🗑️ de cada tarjeta | Precio vacío (400, el modal sigue abierto con lo escrito), código repetido `ARE-001` (409), eliminar un producto con movimientos (409). Pruebe también los **Filtros** (precio, categoría, material, proveedor, disponibilidad) y **Ordenar por** |
| Movimientos | Entrada de 5 al producto nuevo; luego editarla a 8; luego eliminarla | Entrada de 5 a `PUL-002` que tiene 65 (409: "La entrada supera el stock máximo de 67 unidades..."); salida mayor al stock (409) |
| Ficha de producto | Haga clic en la imagen o el nombre de una tarjeta. Elija quién registra, ajuste la **Cantidad** con − y + y presione **Registrar entrada** o **Registrar salida** | Sin elegir empleado (400); entrada de 5 a `PUL-002` (409, supera 67). Revise las pestañas Descripción y Movimientos y la fila Productos similares |
| Inicio | — | El carrusel y las tarjetas usan datos reales; "Nuestras categorías" abre el catálogo ya filtrado; después de registrar movimientos, el gráfico y "Productos con poco stock" cambian solos |

Prueba rápida de toda la API (equivale a Postman o Thunder Client). Con el backend encendido, en otra terminal **desde la carpeta `backend`**:

```
npm run probar-api
```

Ejecuta 135 comprobaciones (los 5 endpoints de las 6 entidades, los errores y las reglas del stock) y al final borra todo lo que creó.

## 12. Reglas del stock (máximo 67) y dónde cambiar el límite

1. El stock se guarda **solo** en `productos.stock`.
2. El stock **no se escribe** en el formulario de productos: la API rechaza `stock` en `POST`/`PUT /api/productos`. Un producto nuevo empieza en 0.
3. Una **entrada** suma y una **salida** resta.
4. **Editar** un movimiento primero revierte su efecto anterior y luego aplica el nuevo (también si se cambia de producto).
5. **Eliminar** un movimiento revierte su efecto.
6. Si el stock quedara por debajo de **0** o por encima de **67**, la operación se rechaza con **409** y un mensaje claro.
7. Cada operación de movimientos cambia dos tablas, por eso usa una **transacción** (`backend/src/models/movimientoModel.js`).

**Para cambiar el máximo:** edite **un solo número** en `backend/src/config/constantes.js`:

```js
export const STOCK_MAXIMO = 67;
```

Reinicie el backend. El frontend lo lee de `GET /api/configuracion`, así que el gráfico, el panel de movimientos y las tablas se actualizan solos.

**Para cambiar los colores:** todos están al inicio de `frontend/src/index.css`, en el bloque `:root` (por ejemplo `--cafe-oscuro`, `--verde-hoja`, `--amarillo-desy`, `--fondo`). Cambie el valor ahí y se actualiza toda la aplicación.

**Para cambiar el logo:** reemplace `frontend/src/assets/logo-desy.png` (logo con fondo transparente, se usa en la cabecera, el menú y el pie de página) y `frontend/public/favicon.png` y `frontend/public/apple-touch-icon.png` (la flor, para la pestaña del navegador). Use los mismos nombres de archivo.

## 13. Generar el build del frontend

**Desde la carpeta `frontend`**:

```
npm run build
```

Crea la carpeta `frontend/dist` con la versión optimizada. Para verla: `npm run preview`. (La carpeta `dist` no se sube a GitHub.)

Revisar el código con el linter: `npm run lint` en `backend` y en `frontend` (debe terminar sin errores).

## 14. Subir el proyecto a GitHub

> Esta parte es **acción pendiente suya**: el proyecto todavía no está publicado.

1. Entre a <https://github.com>, inicie sesión y presione **New** (repositorio nuevo).
2. Nombre: `mini-proyecto-1`. Déjelo **vacío**: no marque README, .gitignore ni licencia. Presione **Create repository**.
3. GitHub le mostrará una dirección que termina en `.git`. Cópiela: esa es la `<URL_DEL_REPOSITORIO>`.
4. En la terminal de VS Code, **desde la carpeta `mini-proyecto-1`** (la raíz, no `backend` ni `frontend`):

```
git init
git add .
git commit -m "Proyecto inicial: sistema de inventario"
git branch -M main
git remote add origin <URL_DEL_REPOSITORIO>
git push -u origin main
```

Reemplace `<URL_DEL_REPOSITORIO>` por la dirección que copió (sin los signos `< >`). Antes del `commit` puede ejecutar `git status` para confirmar que **no** aparecen `node_modules` ni archivos `.env`.

Si Git pregunta su nombre la primera vez: `git config --global user.name "Su nombre"` y `git config --global user.email "su_correo"`.

## 15. Errores comunes y cómo resolverlos

| Mensaje o síntoma | Causa | Solución |
|---|---|---|
| `npm : No se puede cargar el archivo ... npm.ps1 porque la ejecución de scripts está deshabilitada` | Política de PowerShell | Ejecute una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y responda S, o cambie la terminal de VS Code a **Command Prompt** |
| `mysql : El término 'mysql' no se reconoce` | MySQL no está en el PATH | Siga el paso del PATH en la sección 3, o use Workbench (opción A) |
| Backend: `No se pudo conectar a MySQL: ECONNREFUSED` | MySQL está apagado | Servicios de Windows → **MySQL84** → Iniciar |
| `ER_ACCESS_DENIED_ERROR` | Usuario o contraseña incorrectos en `backend/.env` | Revise `DB_USER` y `DB_PASSWORD` (entre comillas) |
| `ER_BAD_DB_ERROR` o `Unknown database` | No se ejecutó `script.sql` | Haga la sección 5 |
| `Table ... doesn't exist` al hacer el seed | Igual que el anterior | Ejecute `script.sql` y luego `npm run seed` |
| `EADDRINUSE: address already in use :::3000` | Ya hay otro backend abierto en el puerto 3000 | Cierre la otra terminal (Ctrl + C) o cambie `PORT` en `backend/.env` **y** `VITE_API_URL` en `frontend/.env` |
| Vite: `Port 5173 is already in use` | Otro frontend abierto | Ciérrelo con Ctrl + C. El puerto está fijo para que coincida con `CORS_ORIGIN` |
| En la página: **"Error de conexión"** | El backend no está encendido o `VITE_API_URL` está mal | Encienda el backend (sección 8) y presione **Reintentar**. Si cambió `frontend/.env`, reinicie `npm run dev` del frontend |
| En la consola del navegador: `blocked by CORS policy` | La dirección del frontend no es igual a `CORS_ORIGIN` | Abra la app en `http://localhost:5173` (no `127.0.0.1`) o ajuste `CORS_ORIGIN` y reinicie el backend |
| `npm run seed` dice "omitidos" en todo | Ya se había ejecutado | Es normal: no duplica datos |
| Cambié `.env` y no pasa nada | Los `.env` solo se leen al arrancar | Reinicie el backend o el frontend |

---

## Recorrido de una operación

Ejemplo: registrar una **entrada de 5 unidades** desde la página Movimientos.

```
Formulario de React -> service -> ruta de Express -> controlador -> modelo -> MySQL -> respuesta JSON -> actualización de la interfaz
```

1. **Formulario de React** (`frontend/src/pages/MovimientosPage.jsx`): la persona elige el producto y escribe la cantidad. Al presionar "Registrar movimiento", la función `guardar` arma los datos (`{ id_producto: 3, tipo: "entrada", cantidad: 5, ... }`) y desactiva el botón ("Guardando...").
2. **Service** (`frontend/src/services/movimientosService.js` → `api.js`): `crearMovimiento(datos)` hace `fetch` a `POST http://localhost:3000/api/movimientos` con los datos en JSON. Es el único lugar que conoce la URL.
3. **Ruta de Express** (`backend/src/routes/movimientoRoutes.js`): `router.post('/', crearMovimiento)` dice qué función atiende esa dirección. Antes, `app.js` revisó CORS y convirtió el JSON en `req.body`.
4. **Controlador** (`backend/src/controllers/movimientoController.js`): valida cada campo (tipo, cantidad entre 1 y 67, fecha real, empleado existente). Si algo está mal responde 400.
5. **Modelo** (`backend/src/models/movimientoModel.js`): abre una **transacción**, bloquea la fila del producto, calcula `stock + 5`, comprueba que no pase de 67, inserta el movimiento y actualiza el stock con consultas preparadas (`?`).
6. **MySQL** guarda los dos cambios juntos (COMMIT). Si algo falla, ROLLBACK y no queda nada a medias.
7. **Respuesta JSON**: el controlador responde `201` con el movimiento creado y el stock nuevo. Si no se podía, el middleware de errores responde `409` con `{ "message": "La entrada supera el stock máximo de 67 unidades..." }`.
8. **Actualización de la interfaz**: React muestra el toast verde, limpia el formulario y vuelve a pedir la lista; la tabla y el panel de stock cambian **sin recargar la página**. Si hubo error, muestra el mensaje y conserva lo escrito.

## Explicación con analogías

- **React** es como armar la tienda con piezas de Lego: cada pieza (botón, tabla, modal) es un componente que se reutiliza, y cuando cambian los datos React vuelve a acomodar solo las piezas necesarias.
- **La API** es el menú de un restaurante: dice qué se puede pedir (`GET /api/productos`, `POST /api/movimientos`) y en qué formato llega (JSON). El frontend es el cliente que pide; no entra a la cocina.
- **Express** es el mesero: recibe el pedido, lo lleva a la persona correcta (ruta → controlador) y vuelve con la respuesta. Si el pedido no existe en el menú, responde "eso no lo tenemos" (404).
- **MySQL** es la bodega con estantes rotulados (tablas). Cada estante tiene columnas fijas y reglas: no se aceptan cajas sin etiqueta (campos obligatorios) ni dos cajas con el mismo código (UNIQUE).
- **El pool de conexiones** es como tener varias cajas abiertas en un banco: en lugar de abrir y cerrar una caja por cada cliente, hay unas cuantas listas y se van turnando.
- **Las llaves foráneas** son como la etiqueta de un producto que dice "proveedor: Brillos del Pacífico". No se puede poner la etiqueta de un proveedor que no existe, y no se puede botar al proveedor mientras haya productos con su etiqueta.
- **Las transacciones** son como una transferencia bancaria: el dinero sale de una cuenta y entra a la otra, o no pasa nada. Aquí: se guarda el movimiento y se actualiza el stock, o no se guarda ninguno.
- **El seed** es como surtir la tienda el día de la inauguración con una lista (`db.json`). Si vuelve a leer la lista otro día, solo repone lo que falta; no duplica lo que ya está en el estante.
