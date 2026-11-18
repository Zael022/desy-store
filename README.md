# Desy · Tienda, inventario y ventas con 5 roles y verificación en dos pasos

Mini Proyecto 1 · Sistema empresarial con Node.js, React y MySQL (versión 2).

Sistema web para **Desy**, tienda de bisutería y accesorios. La versión 1 organizaba productos, categorías, proveedores, materiales, empleados y las entradas y salidas de mercadería (stock de 0 a **67** unidades por producto). La versión 2 mantiene todo eso y agrega:

- **Cinco roles**, cada uno con su propia pantalla: Cliente, Proveedor, Ventas, Administración y Dueña.
- **Verificación en dos pasos (MFA) obligatoria** en cada inicio de sesión: contraseña + código de 6 dígitos por correo o SMS.
- **Punto de venta** y **devoluciones** conectados al inventario (usan la misma lógica de movimientos).
- **Solicitudes de abastecimiento** a proveedores, **dashboard ejecutivo** con costos y ganancias, **auditoría** y **configuración**.
- **Fotos de los productos y subcategorías** (6 de noviembre): los 12 productos reales de Desy con sus 29 fotos, Crochet dividido en Peluches, Llaveros de crochet y Decoración, galería en la ficha y una ventana para subir, ordenar y borrar fotos.
- **Pedidos de clientes** (10 de noviembre): el cliente arma su pedido en el catálogo y lo envía; las unidades quedan **apartadas** mientras espera la confirmación de la tienda. Ventas, Administración o Dueña lo confirma o rechaza (con aviso por correo) y, al entregarlo y cobrarlo, se registra la venta. Si nadie lo atiende o no se recoge a tiempo, vence solo y las unidades se liberan.

Tecnologías: React + Vite, React Router, Motion, Recharts, lucide-react y react-hot-toast en el frontend; Node.js + Express (API REST en JSON) y MySQL 8 con `mysql2/promise` (pool y consultas preparadas) en el backend. Solo JavaScript, sin ORM ni Redux.

Documentación (carpeta `docs/`):

| Archivo | Qué contiene |
|---|---|
| [analisis-inicial.md](docs/analisis-inicial.md) | Fase 1: qué había, qué se reutiliza y el diseño de la versión 2 |
| [matriz-de-permisos.md](docs/matriz-de-permisos.md) | Cada ruta de la API y qué rol puede usarla (generada desde el código) |
| [endpoints.md](docs/endpoints.md) | Método, ruta, roles, cuerpo de ejemplo y respuestas de los 105 endpoints |
| [diagrama-simple.md](docs/diagrama-simple.md) / [diagrama-completo.md](docs/diagrama-completo.md) | Diagramas entidad-relación (24 tablas) |
| [diccionario-de-datos.md](docs/diccionario-de-datos.md) | Cada campo con su tipo, llaves y reglas |
| [pruebas.md](docs/pruebas.md) | Qué se probó de verdad, cómo, con qué resultado y qué queda pendiente |
| [checklist.md](docs/checklist.md) | Cada requisito con su archivo, evidencia y estado |
| [tema-y-justificacion.md](docs/tema-y-justificacion.md) | Problema de la empresa y alcance |

---

## 1. Requisitos y versiones

| Programa | Versión | Para qué |
|---|---|---|
| Node.js | **22 LTS o 24 LTS** (mínimo 20.19). Probado con 22.23.4 | Backend y herramientas del frontend |
| npm | El que trae Node (probado con 10.9.9) | Instalar librerías |
| MySQL Community Server | **8.4 LTS** (también funciona en 8.0; probado con 8.0.46) | Base de datos |
| MySQL Workbench | Reciente (opcional) | Ver la base con ventanas |
| Visual Studio Code y Git | Recientes | Editor y GitHub |

### Dependencias nuevas de la versión 2

| Paquete | Versión | Dónde | Para qué |
|---|---|---|---|
| argon2 | 0.45.2 | backend (opcional) | Hash de contraseñas con **Argon2id** (trae binarios listos para Windows x64) |
| bcryptjs | 3.0.3 | backend | Plan B si argon2 no se instala: bcrypt con costo 12 (100 % JavaScript) |
| cookie-parser | 1.4.7 | backend | Leer las cookies de sesión, del desafío MFA y del token CSRF |
| helmet | 8.3.0 | backend | Cabeceras de seguridad del navegador |
| express-rate-limit | 8.7.3 | backend | Límite de intentos por IP (login, códigos, recuperación) |
| nodemailer | 10.3.1 | backend | Enviar correos por SMTP (Gmail u otro proveedor) |
| supertest | 7.3.1 | backend (desarrollo) | Pruebas automáticas de la API (`npm test`) |
| smtp-server | 3.21.3 | backend (desarrollo) | Servidor SMTP local para probar el envío real de correos en `npm test` |
| multer | 2.5.0 | backend | Recibir las fotos que se suben (formulario `multipart/form-data`) |
| sharp | 0.35.5 | backend | Revisar cada foto y convertirla a WebP liviana y sin datos GPS (trae binarios listos para Windows x64) |

El SMS usa la API REST de Twilio con `fetch` (incluido en Node), sin paquete extra. Siguen las de la versión 1: express 5.3.0, mysql2 3.24.6, dotenv 16.6.1, cors 2.8.6; react 19.3.1, vite 8.3.5, react-router 8.5.1, motion 14.9.1, recharts 3.10.1, lucide-react 1.68.0, react-hot-toast 2.6.1.

## 2. Instalación

1. Descomprima el ZIP y abra la carpeta `mini-proyecto-1` en VS Code (**File → Open Folder...**). Va a usar **dos terminales** (botón **+** de la terminal): una para `backend` y otra para `frontend`.
2. Si todavía no tiene MySQL 8, instálelo con el [Anexo A](#anexo-a-instalar-mysql-8-en-windows).
3. Instale las librerías:

```
cd backend
npm install
```

y en la otra terminal:

```
cd frontend
npm install
```

Si `npm install` del backend avisa que no pudo instalar **argon2** (en algunos Windows falta algo para compilarlo), no pasa nada: es opcional y el backend usa **bcrypt con costo 12** automáticamente. Al arrancar, la consola dice cuál está usando (`Contraseñas: argon2id` o `bcrypt`).

4. Cree el archivo de variables del backend, **desde la carpeta `backend`**:

```
copy .env.example .env
```

Abra `backend/.env` y complete como mínimo:

- `DB_PASSWORD="la_contraseña_de_root"` (entre comillas si tiene `#`).
- `CODIGOS_SECRETO`: genere uno y péguelo:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- Para empezar sin Gmail ni Twilio: `NODE_ENV=development` y `MFA_MODO_CONSOLA=true` (ver la sección 8).

El frontend no necesita `.env` (por defecto usa `/api`). Si ya tenía un `frontend/.env` de la versión 1 con `VITE_API_URL=http://localhost:3000/api`, cámbielo a `VITE_API_URL=/api` (o bórrelo): así las cookies pasan por el proxy de Vite sin problemas.

## 3. Migraciones (actualizar la base de datos)

Las migraciones son archivos numerados en `backend/database/migraciones/` (`001_...sql` a `008_...sql`) que agregan las tablas y columnas nuevas **sin borrar sus datos**. La 006 agrega las subcategorías (`categorias.id_categoria_padre`) y la tabla `producto_fotos`; la 007, la marca de "foto con medidas" (`producto_fotos.es_de_medidas`); la 008, los pedidos de clientes (`pedidos`, `detalle_pedidos` y los dos plazos en `configuracion`).

**Si ya tenía la base de la versión 1** (su caso): solo ejecute, desde `backend`:

```
npm run migrar
```

**Si empieza de cero:** primero cree la base con `script.sql` (Workbench: **File → Open SQL Script** → `backend/database/script.sql` → rayo ⚡; o en la terminal `mysql -u root -p -e "source database/script.sql"`) y después `npm run migrar`.

Cómo funciona: `npm run migrar` aplica en orden las migraciones pendientes y anota cada una en la tabla `migraciones_aplicadas`. Si lo ejecuta otra vez, dice "ya aplicada" y no cambia nada. Una base de la v1 migrada queda **exactamente igual** que una base nueva creada con `script.sql` (lo comprueba `npm test`).

## 4. Seed (datos de ejemplo)

```
npm run seed
```

Carga desde `backend/database/db.json`: categorías, proveedores, materiales, empleados, 9 productos (con costo en la mayoría y dos sin costo), movimientos, 4 cuentas de personal y proveedores, 2 clientes, 4 ventas, 1 devolución y 2 solicitudes de abastecimiento. Las ventas y la devolución se registran con las **mismas funciones** que usa la aplicación, así que sus salidas y entradas de inventario son reales.

- Se puede ejecutar muchas veces: lo que ya existe se omite (no duplica, no borra).
- **Las cuentas del seed no tienen contraseña** (no hay contraseñas publicadas). Se activan así: el personal y los proveedores con **Reenviar invitación** desde Usuarios (como dueña); los clientes del seed con **Olvidé mi contraseña**.
- En su base de la v1, los productos ya existían, así que quedan **sin costo**: regístrelo como dueña en Productos (el dashboard le avisa cuáles faltan).

### Productos reales de Desy (con fotos)

Al final, `npm run seed` carga también los productos de `backend/database/productos-desy.json`: 12 productos (collar, peluches, llaveros de crochet, flor tejida y llaveros de acrílico) con sus **29 fotos** (en `backend/database/fotos/`), las categorías Crochet > Peluches, Llaveros de crochet y Decoración, Llaveros, y 4 materiales nuevos.

- Si solo quiere cargar estos productos (sin el resto del seed): `npm run cargar-productos`.
- Las categorías, materiales y proveedores se buscan **por nombre** (si ya existe "Collares", se usa esa). Un producto cuyo código ya existe **no se toca**.
- El stock inicial (`stock_inicial`) entra como una **entrada** en Movimientos, nunca escrito a mano.
- En cada producto, `fotos` son las fotos normales (la primera es la principal) y `fotos_medidas` las que muestran medidas: esas nunca son la principal.
- **Los precios son de ejemplo.** Cámbielos en `productos-desy.json` **antes** de cargarlos o, después, como dueña en Productos. El costo queda vacío: regístrelo como dueña.
- Las fotos se copian a `backend/uploads/productos/` (esa carpeta no se sube a GitHub). Si en otra computadora no se ven, ejecute `npm run cargar-productos` y se vuelven a copiar.

## 5. Crear la primera dueña

```
npm run crear-duena
```

Le pide nombre, correo, teléfono (opcional, formato `+50688887777`) y contraseña (no se ve al escribirla). Si el correo coincide con un empleado sin cuenta, la vincula a él; si no, le deja elegir uno de la lista o la registra como empleada nueva. Después **envía un código a su correo** y le pide escribirlo (en modo consola el código aparece en esa misma terminal). Guarda solo el hash de la contraseña y nunca la imprime. **Si ya existe una dueña, no hace nada.**

Alternativa sin preguntas: ponga `DUENA_NOMBRE`, `DUENA_CORREO` y `DUENA_CONTRASENA` en el `.env`, ejecute el comando (igual le pide el código) y **después bórrelos del `.env`**.

## 6. Configurar Gmail (SMTP) paso a paso

La contraseña normal de Gmail **no funciona** para SMTP: Google exige una **contraseña de aplicación**, y esa opción solo aparece con la verificación en 2 pasos activa.

1. Entre a <https://myaccount.google.com> con la cuenta que enviará los correos.
2. **Seguridad → Cómo inicias sesión en Google → Verificación en 2 pasos** → actívela.
3. Abra <https://myaccount.google.com/apppasswords> (o escriba "contraseñas de aplicaciones" en el buscador de su cuenta). Si no aparece, revise que la verificación en 2 pasos esté activa; no aparece en cuentas de trabajo o escuela, ni si solo usa llaves de seguridad.
4. Escriba un nombre, por ejemplo `Desy`, y presione **Crear**. Copie la contraseña de **16 letras** (puede pegarla sin espacios).
5. En `backend/.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=su_correo@gmail.com
SMTP_PASS=lascontrasenade16
SMTP_FROM="Desy <su_correo@gmail.com>"
MFA_MODO_CONSOLA=false
```

6. Reinicie el backend. Debe decir `Correo (SMTP): configurado`. Pruebe con **Crear cuenta** usando un correo suyo.

Si cambia la contraseña de su cuenta de Google, Google anula las contraseñas de aplicación: cree una nueva. Si prefiere otro proveedor (Brevo, Mailgun, SendGrid...), use su host, puerto, usuario y clave SMTP en las mismas variables.

## 7. Configurar Twilio (SMS) paso a paso

1. Cree una cuenta en <https://www.twilio.com/try-twilio> (prueba gratuita de 30 días). Al registrarse verifica su propio celular.
2. En la **Console**, en *Account Info*, copie el **Account SID** (empieza con `AC`) y el **Auth Token**.
3. Obtenga un número de Twilio con SMS (en la consola: *Phone Numbers → Buy a number*; la cuenta de prueba permite uno).
4. Cada número que vaya a **recibir** SMS debe estar verificado: *Phone Numbers → Manage → Verified Caller IDs → Add a new Caller ID* (Twilio le manda un código a ese número). La prueba permite hasta 5.
5. En `backend/.env`:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=su_auth_token
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
```

6. Reinicie el backend (`SMS (Twilio): configurado`). En la app: **Perfil y seguridad → Teléfono → Verificar**, escriba su número en formato `+506 8888 7777` y confirme el código. Desde ese momento puede elegir **SMS** en el inicio de sesión.

**Importante sobre la cuenta de prueba (según la documentación actual de Twilio):** solo envía a números verificados, solo dentro del país con el que se registró y **no permite textos propios** (obliga a usar plantillas de Twilio). Como Desy envía su propio mensaje con el código, es posible que la cuenta de prueba lo rechace. En ese caso el backend responde un error claro con el **código de Twilio** (nunca dice "enviado") y usted puede seguir con el correo. Para usar SMS de verdad hay que **actualizar la cuenta de Twilio** (de pago). Esto no se pudo probar con su cuenta: ver [pruebas.md](docs/pruebas.md).

## 8. Modo consola (desarrollo sin Gmail ni Twilio)

Con `NODE_ENV=development` **y** `MFA_MODO_CONSOLA=true` en el `.env`, los códigos y enlaces **no se envían**: aparecen en la terminal del backend, así:

```
[MODO CONSOLA] Correo para lucia@correo.com
  Asunto: Desy · Código de verificación
  Su código para iniciar sesión es 482913. Vence en 5 minutos. ...
```

- Igual hay que **escribir el código** en la pantalla: el segundo factor nunca se salta.
- Sirve para correos, SMS, recuperación de contraseña e invitaciones (el enlace aparece completo).
- En `NODE_ENV=production` se ignora aunque diga `true` (la consola avisa).
- Si el modo está apagado y falta SMTP o Twilio, la app responde un error claro (503) diciendo qué variable falta.

## 9. Iniciar el backend y el frontend

Terminal 1, en `backend`:

```
npm run dev
```

Debe ver `API escuchando en http://localhost:3000/api`, `Contraseñas: argon2id` (o bcrypt), el estado del correo/SMS y `Conectado a MySQL`. Si falta `CODIGOS_SECRETO`, no arranca y le dice por qué.

Terminal 2, en `frontend`:

```
npm run dev
```

Abra <http://localhost:5173>. El frontend pide todo a `/api` y Vite lo reenvía al backend (proxy en `frontend/vite.config.js`); por eso las cookies funcionan sin configurar nada más.

Otros comandos del backend: `npm start` (sin reinicio automático), `npm test` (pruebas automáticas, sección 12), `npm run lint`, `npm run matriz` (regenera `docs/matriz-de-permisos.md`).

## 10. Cómo probar cada rol

Prepare: `npm run migrar`, `npm run seed`, `npm run crear-duena`, backend con modo consola, frontend.

| Rol | Cómo entrar | Qué probar |
|---|---|---|
| **Dueña** | Su cuenta de `crear-duena`. Después del código va a **/duena** | Dashboard (cambie fechas o use "Últimos 7/30/90 días"), aviso de productos sin costo → regístrelo en Productos (campo *Costo unitario*, solo usted lo ve), **Configuración** (umbral de "pocas unidades"), **Usuarios**: reenvíe la invitación a Mariana (ventas), Andrés (administración) y Brillos del Pacífico (proveedor), corrija el correo de una invitación con el lápiz ✏️, cambie roles internos |
| **Ventas** (Mariana) | Abra el enlace de la invitación (en modo consola está en la terminal del backend), defina contraseña, inicie sesión → **/pos** | Busque productos, agréguelos, ponga más cantidad que el stock (aparece la alerta y no deja confirmar), asocie a la clienta "Camila", confirme. En **Mis ventas** abra la venta y registre una devolución con motivo |
| **Administración** (Andrés) | Igual con su invitación → **/admin** | Panel (stock bajo, solicitudes), CRUD de siempre en Productos, Movimientos, Categorías, Proveedores, Materiales, Empleados; **Abastecimiento** → Nueva solicitud a Brillos del Pacífico; Usuarios (solo puede crear Ventas/Proveedor); Auditoría. Abra /duena: "no es para su cuenta" |
| **Proveedor** (Brillos del Pacífico) | Su invitación → **/proveedor** | Solicitudes → Ver → Aceptar o Rechazar (con motivo); Mis productos (solo los suyos, sin costos); Mis datos |
| **Administración otra vez** | — | Abastecimiento → la solicitud aceptada → **Marcar como recibida**: se registran las entradas (vea Movimientos, columna *Origen*) |
| **Cliente nuevo** | **Crear cuenta** → código en el correo → iniciar sesión → **/cliente** | Mis compras (vacío), Perfil y seguridad: verifique su teléfono (SMS) y vuelva a entrar eligiendo SMS |
| **Cliente del seed** (Camila) | **Olvidé mi contraseña** con `camila.mora@example.com` → enlace → contraseña nueva | En Mis compras aparece la venta que hizo Mariana a su nombre, sin costos |
| **Pedido completo** | Sin sesión, en el **Catálogo** | "Agregar al pedido" en dos productos (en la ficha puede elegir la cantidad) → **Mi pedido** (cesta de la cabecera) → "Iniciar sesión para enviar" (entra Camila y vuelve a Mi pedido) → nota → **Enviar pedido**. Queda "Esperando confirmación" en **Mis pedidos**. Como Mariana: la cabecera avisa "Pedidos de clientes (1)" → **Confirmar** → pestaña *Listos para recoger* → **Entregar y cobrar** (registra la venta). Camila lo ve como *Entregado* y en Mis compras. Pruebe también **Rechazar** (pide motivo) y **Cancelar pedido** desde Mis pedidos |

Más pruebas rápidas: contraseña incorrecta 5 veces (bloqueo de 15 minutos), código incorrecto (le dice cuántos intentos quedan), "Reenviar código" antes de 60 segundos (deshabilitado), dejar la sesión 30 minutos sin usar (vuelve al login con aviso).

## 11. Reglas del negocio

### Stock (igual que en la versión 1)

1. El stock está solo en `productos.stock`, de 0 a **67** (`STOCK_MAXIMO` en `backend/src/config/constantes.js`, el único lugar donde está el 67).
2. Solo cambia con **movimientos**. La función `registrarMovimiento()` de `backend/src/models/movimientoModel.js` es la **única** forma de cambiarlo: la usan el CRUD de movimientos, las ventas, las devoluciones y el abastecimiento.
3. Todo cambio va en una **transacción** con la fila del producto bloqueada (`SELECT ... FOR UPDATE`). Si quedaría por debajo de 0 o por encima de 67: **409** con mensaje claro y no se guarda nada.

### Ventas

1. Se confirman en **una transacción**: se bloquean los productos (en orden de ID), se revisa el stock de **todos**, se guarda la venta y su detalle y se registra **una salida por producto** enlazada a la venta. Si falta stock de uno: **409** ("No hay suficiente stock de X: hay N disponibles y la venta pide M"; si hay unidades apartadas en pedidos, lo dice) y no se guarda nada.
2. **Idempotencia:** el navegador genera una clave única (`crypto.randomUUID`) por venta y el botón se deshabilita mientras envía. Si la misma clave llega dos veces (doble clic, conexión que se corta), se responde la venta ya registrada (200, `repetida: true`) sin cobrar dos veces.
3. Se guardan el **precio y el costo del momento** en `detalle_ventas` (si mañana cambia el precio, la venta conserva el de ese día).
4. Una venta confirmada **no se edita ni se borra**: se corrige con una devolución. Sus movimientos tampoco se pueden editar ni borrar (409).
5. El rol Ventas solo ve y devuelve **sus** ventas; Administración y Dueña ven todas. Solo la Dueña ve costos.

### Devoluciones

1. Se elige la venta, los productos, la cantidad (máximo lo vendido **menos lo ya devuelto**) y un **motivo** obligatorio.
2. Las unidades vuelven con una **entrada** enlazada a la devolución, en una transacción.
3. Si la entrada haría pasar el producto de 67: **409** explicando cuántas tiene, y no se guarda nada.

### Abastecimiento

Pendiente → el proveedor **acepta** o **rechaza** (con motivo) → Administración **recibe** (una entrada por producto, todo o nada; si alguno pasaría de 67, no entra ninguno) o **cancela**. Solo se pueden pedir productos de ese proveedor.

### Pedidos de clientes (productos apartados)

Analogía: es como apartar ropa en una tienda. La prenda sigue en el local (el **stock no cambia**), pero ya no se le puede vender a otra persona.

1. **Disponible = stock − apartado.** Apartado = unidades en pedidos *pendientes* o *confirmados* que todavía no vencieron (`backend/src/models/apartados.js`). El catálogo, el punto de venta y los movimientos de salida usan lo disponible: no se pueden vender ni sacar unidades apartadas (409 explicando cuántas están apartadas).
2. **Hacer el pedido** (solo clientes): se arma en "Mi pedido" (se guarda en el navegador; ahí todavía no se aparta nada). Al **enviarlo**, en una transacción se bloquean los productos, se revisa lo disponible de todos y se guarda el pedido. Si algo ya no alcanza: 409 y no se guarda nada. Tiene **clave de idempotencia** como las ventas (un doble clic no aparta dos veces). Límites: **3 pedidos en curso** por cliente, 20 productos y 10 unidades por producto.
3. **Estados:** *pendiente* ("Esperando confirmación") → *confirmado* ("Listo para recoger") → *entregado*. También *rechazado* (la tienda, con motivo), *cancelado* (el cliente) y *vencido*.
4. **Plazos** (la Dueña los cambia en **Configuración**): la tienda tiene **48 horas** para confirmar; el cliente tiene **7 días** para recoger un pedido confirmado. Si se pasan, el pedido **vence** y las unidades se liberan **al instante**; además, cada 5 minutos (y cada vez que alguien abre los pedidos) se marca como *vencido* y se avisa al cliente.
5. **Entregar y cobrar** registra una **venta normal** (con su salida de inventario, a nombre del cliente) usando `registrarVenta()`, y se cobra el **precio del pedido** aunque el producto haya subido. La venta aparece en "Mis compras" del cliente y se corrige con devoluciones como cualquier otra.
6. **Avisos por correo** al cliente: pedido recibido, confirmado, rechazado (con el motivo) y vencido. Si el correo falla, el pedido igual cambia de estado y el cliente lo ve en "Mis pedidos" (el backend lo anota en la consola).
7. Quién atiende: **Ventas, Administración y Dueña** (pantalla **Pedidos de clientes**, `/pos/pedidos`). El cliente y el empleado que atiende salen siempre de la sesión.

### Fotos y subcategorías

1. **Subcategorías:** en Categorías, el campo "Dentro de" pone una categoría dentro de otra (por ejemplo, Peluches dentro de Crochet). Solo hay **dos niveles**: no se puede poner una categoría dentro de una subcategoría, ni dentro de sí misma, y una que tiene subcategorías no puede quedar dentro de otra (400). Una categoría con subcategorías o productos no se borra (409).
2. En los filtros del catálogo y de Productos, marcar **Crochet** incluye sus subcategorías. La portada muestra solo las categorías principales.
3. **Fotos:** las suben Administración y Dueña desde el botón de fotos de cada tarjeta, desde la ficha ("Administrar fotos") o justo después de crear un producto. JPG, PNG o WebP de hasta **5 MB**, mínimo 200 x 200 píxeles y **8 por producto**. La primera es la **principal** (la del catálogo); se cambia con la estrella.
4. **Fotos con medidas:** se marcan con el botón de la **regla** (o, antes de subirlas, con la casilla "Las fotos que voy a agregar tienen medidas"). Una foto con medidas **nunca es la principal**: el backend la deja siempre al final, no la usa en las tarjetas del catálogo y responde 409 si se intenta hacerla principal. Si un producto solo tiene fotos con medidas, en el catálogo se ve el ícono de su categoría. En la ficha, esas fotos dicen "Medidas".
5. El backend revisa cada archivo con `sharp` (no se fía de la extensión), lo convierte a **WebP** de máximo 1200 x 1500, quita los datos ocultos del celular (como la ubicación GPS) y le pone un nombre al azar. En MySQL se guarda solo el nombre del archivo; la imagen queda en `backend/uploads/productos/`.
6. Al borrar una foto o un producto, el archivo también se borra del disco.

### Costos y ganancias

`productos.costo_unitario` es opcional. Solo la Dueña lo ve y lo cambia (si Administración lo envía: 403; si edita un producto sin enviarlo, el costo se conserva). Las ganancias se calculan **solo con líneas que tienen costo**; el dashboard avisa cuántas no lo tienen y qué productos faltan. No hay datos inventados.

## 12. Pruebas automáticas

Desde `backend`:

```
npm test
```

Usa una base **separada** (`DB_NAME_PRUEBAS`, por defecto `inventario_bisuteria_prueba`) que borra y crea de cero en cada archivo de prueba: **nunca toca su base**. El usuario de MySQL del `.env` necesita permiso para crearla (root lo tiene). Son 81 pruebas (MFA, permisos por rol, CSRF, ventas, devoluciones, abastecimiento, las 136 comprobaciones del inventario original, envío real por SMTP y a una API que imita a Twilio, migraciones, fotos y subcategorías, y pedidos con unidades apartadas). Las fotos de las pruebas se guardan en una carpeta temporal, no en `backend/uploads`. Detalle en [pruebas.md](docs/pruebas.md).

## 13. Errores comunes

| Síntoma | Causa | Solución |
|---|---|---|
| El backend no arranca: "CODIGOS_SECRETO debe tener al menos 32 caracteres" | Falta el secreto | Sección 2, paso 4 |
| `Table 'usuarios' doesn't exist` / "Falta aplicar las migraciones" | No se migró | `npm run migrar` |
| **Las cookies no llegan**: inicia sesión y vuelve al login, o "Debe iniciar sesión" en todo | Abrió el frontend en otra dirección, o `VITE_API_URL` apunta directo al puerto 3000 | Abra <http://localhost:5173> (no `127.0.0.1`), use `VITE_API_URL=/api` o bórrelo, reinicie el frontend. No use el modo incógnito con cookies bloqueadas |
| "La solicitud no tiene un token CSRF válido" | El token cambió (por ejemplo, cerró sesión en otra pestaña) | Recargue la página (el frontend reintenta solo una vez) |
| `blocked by CORS policy` en la consola del navegador | Llamó a la API directo desde un origen distinto de `CORS_ORIGIN` | Use el proxy (`/api`) o ponga en `CORS_ORIGIN` la dirección exacta del frontend |
| `EADDRINUSE :3000` o `Port 5173 is already in use` | Otro backend o frontend abierto | Ciérrelo con Ctrl + C. 5173 es fijo porque es el de `CORS_ORIGIN` |
| Gmail: "El servidor de correo rechazó el usuario o la contraseña... contraseña de aplicación" (503) | Usa la contraseña normal o la de aplicación está mal | Sección 6. Sin espacios extra; reinicie el backend |
| Gmail: no se puede conectar | Puerto o red | `SMTP_PORT=587` con `SMTP_SECURE=false`, o `465` con `true`. Algunas redes bloquean SMTP |
| Twilio: "el número de destino debe estar verificado" | Cuenta de prueba | Verifique el número en *Verified Caller IDs* (sección 7) |
| Twilio: "código de Twilio XXXXX" | Restricción de la cuenta de prueba (texto propio, otro país) u otro problema | Busque el código en la documentación de Twilio; use el correo mientras tanto |
| La página dice "Error de conexión" | El backend está apagado o reiniciándose (Vite no lo alcanza) | Encienda el backend (`npm run dev` en `backend`) y presione **Reintentar**: la sesión sigue abierta |
| "Espere N segundos antes de pedir otro código" / "demasiados códigos en la última hora" | Protección contra abuso | Espere. En desarrollo puede subir `CODIGOS_MAXIMO_POR_HORA` |
| "Demasiados intentos fallidos... 15 minutos" | 5 contraseñas incorrectas seguidas | Espere 15 minutos o use "Olvidé mi contraseña" (al restablecer se desbloquea) |
| `ER_ACCESS_DENIED_ERROR` / `ECONNREFUSED` | Contraseña de MySQL o MySQL apagado | Revise `DB_PASSWORD`; Servicios de Windows → MySQL84 → Iniciar |
| `npm test` falla con "Access denied ... inventario_bisuteria_prueba" | El usuario de MySQL no puede crear bases | Use root en el `.env` o dé permisos sobre esa base |
| Los datos del seed no tienen contraseña | Es a propósito | Sección 4 |
| `npm install` del backend falla en **sharp** | Descarga incompleta o red que bloquea los binarios | Vuelva a ejecutar `npm install` en `backend`. Si sigue, `npm install --include=optional sharp` |
| Los productos se ven con ícono y no con foto | No se ejecutó la migración 006 / el seed, o falta la carpeta `backend/uploads/productos` (por ejemplo, después de clonar de GitHub) | `npm run migrar` y `npm run cargar-productos` (vuelve a copiar las fotos iniciales); reinicie el backend |
| "La foto pesa más de 5 MB" / "Formato no permitido" | Foto muy pesada, o HEIC de iPhone, o GIF | Use JPG, PNG o WebP; en iPhone: Ajustes → Cámara → Formatos → "Más compatible" |
| "Cada producto puede tener como máximo 8 fotos" | Ya tiene 8 | Borre una antes de subir otra |
| Al vender o registrar una salida: "...tiene N unidad(es) apartadas en pedidos de clientes" | Esas unidades están en pedidos pendientes o confirmados | Atienda el pedido en **Pedidos de clientes** (entréguelo o recházelo) o venda solo las libres |
| El cliente no recibe el correo de su pedido | Gmail sin configurar o rechazó la clave | Mire la terminal del backend (`[Pedidos] No se pudo enviar el aviso...`). El pedido igual cambió de estado y el cliente lo ve en Mis pedidos |
| "Ya tiene 3 pedidos en curso" | Límite por cliente | Que la tienda atienda alguno o que el cliente cancele uno |

## 14. Seguridad, explicada simple

- **Hash de contraseñas (Argon2id):** es como una licuadora: convierte la contraseña en un batido del que no se puede volver a sacar la fruta. Se guarda el batido; al iniciar sesión se licúa lo que escribió y se comparan. Si alguien roba la base, no ve las contraseñas.
- **Sesión y cookie:** al pasar el MFA, el servidor le da una "pulsera de evento" (un token al azar) dentro de una cookie **HttpOnly**: el navegador la muestra en cada petición, pero ningún código de la página la puede leer. En MySQL se guarda solo el hash de la pulsera. Vence a los 30 minutos sin uso o a las 8 horas; al cerrar sesión se anula en el servidor.
- **MFA:** para entrar a la bodega hace falta la llave (contraseña) **y** un código que llega en ese momento a su correo o teléfono. Si roban la llave, no alcanza. El código vence en 5 minutos, sirve una vez, permite 5 intentos y se guarda como HMAC (otra licuadora, con un ingrediente secreto del `.env`).
- **CSRF:** un sitio malicioso podría intentar que su navegador envíe una orden a Desy usando su cookie. Para evitarlo, cada orden lleva además una "contraseña del día" (token CSRF) que ese sitio no puede conocer. Las cookies también son `SameSite=Lax`.
- **RBAC (permisos por rol):** como los gafetes de un hotel: la tarjeta de huésped abre su cuarto, la de limpieza abre pasillos, la de gerencia abre todo. La lista de qué abre cada gafete está en `backend/src/config/permisos.js` y se revisa en **cada** petición. Esconder un botón en React es solo decoración: la puerta la cierra el backend.
- **Transacciones:** una transferencia bancaria: el dinero sale y entra, o no pasa nada. Una venta guarda la venta, su detalle y todas las salidas, o nada.
- **Idempotencia:** el número de ticket de una fila: si llega dos veces el mismo ticket, se atiende una sola vez.
- **Auditoría:** el libro de visitas de la bodega: quién entró, qué hizo, cuándo y desde dónde. Nunca anota contraseñas ni códigos.
- **Mensajes genéricos:** el login responde "Correo o contraseña incorrectos" en ambos casos y "Olvidé mi contraseña" responde lo mismo exista o no el correo, para que nadie pueda averiguar quién tiene cuenta.

## 15. Subir los cambios a GitHub

Su repositorio ya existe (<https://github.com/Zael022/desy-store.git>). Desde la carpeta `mini-proyecto-1`:

```
git status
git add .
git commit -m "Version 2: roles, MFA, ventas, devoluciones y abastecimiento"
git push
```

Antes del commit, `git status` **no** debe mostrar `node_modules` ni ningún `.env` (están en `.gitignore`). Nunca suba la contraseña de MySQL, la de Gmail ni el token de Twilio.

## 16. Personalizar

- **Stock máximo:** `STOCK_MAXIMO` en `backend/src/config/constantes.js`.
- **Umbral de "pocas unidades", stock visible para proveedores y mensaje del catálogo:** como dueña en **Configuración** (sin tocar código).
- **Tiempos de sesión y límites:** variables del `.env` (`SESION_INACTIVIDAD_MINUTOS`, `CODIGOS_MAXIMO_POR_HORA`, ...).
- **Colores:** bloque `:root` al inicio de `frontend/src/index.css`. **Logo:** `frontend/src/assets/logo-desy.png`.
- **Productos iniciales y sus precios:** `backend/database/productos-desy.json` (antes de cargarlos). **Máximo de fotos y peso:** `MAXIMO_FOTOS_POR_PRODUCTO` y `TAMANO_MAXIMO_BYTES` en `backend/src/servicios/fotos.js` (y los mismos números en `frontend/src/components/ModalFotos.jsx`). **Carpeta de fotos:** variable `CARPETA_FOTOS` del `.env` (opcional).

## Anexo A. Instalar MySQL 8 en Windows

1. Entre a <https://dev.mysql.com/downloads/mysql/>.
2. En **Select Version** elija la versión **8.4.x LTS** y en **Select Operating System**, **Microsoft Windows**.
3. En la lista aparecen varias descargas parecidas. Use el botón **Download** de la **primera fila: "Windows (x86, 64-bit), MSI Installer"** (pesa unos 130 MB y el archivo termina en **`.msi`**, por ejemplo `mysql-8.4.11-winx64.msi`). **No** elija "ZIP Archive" (unos 268 MB, termina en `.zip`): ese no trae instalador. Si le pide iniciar sesión, haga clic en **"No thanks, just start my download"**.
   - Si al abrir el `.msi` Windows dice que falta "Microsoft Visual C++", instale el **Microsoft Visual C++ Redistributable (x64)** desde la página de Microsoft y vuelva a abrir el `.msi`.
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
