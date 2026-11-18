# Análisis inicial y diseño de la integración

Punto de partida para convertir el inventario de Desy en un sistema con cinco roles y autenticación de dos factores. Todo lo de la sección 1 se verificó leyendo el código y consultando `information_schema` en MySQL 8 (no se supuso nada).

Origen del proyecto: la última versión entregada en esta conversación (inventario con el logo y la paleta de Desy). No llegó un ZIP nuevo con este pedido; si la copia de Daisy tiene cambios propios, hay que combinarlos.

## 1. Lo que existe

### 1.1 Archivos revisados

| Archivo pedido | Existe | Qué hace |
|---|---|---|
| `frontend/src/App.jsx` | Sí | `MotionConfig reducedMotion="user"`, `BrowserRouter`, `AppRoutes` y `Toaster` (react-hot-toast) |
| `frontend/src/routes/AppRoutes.jsx` | Sí | Todas las páginas dentro de `<Layout />`: `/`, `/productos`, `/productos/:id`, `/movimientos`, `/categorias`, `/proveedores`, `/materiales`, `/empleados`, `*` |
| `frontend/src/components/Layout.jsx` | Sí | Cabecera (menú ☰ con `Modal` lateral, logo, `BuscadorCabecera`, accesos), `<Outlet />` y `PiePagina` |
| `frontend/src/services/api.js` | Sí | Único `fetch` del frontend; lanza `Error` con el `message` del backend y marca `esDeConexion` |
| `backend/src/app.js` | Sí | CORS al origen del `.env`, `express.json`, rutas en `/api`, 404 y manejador de errores |
| `backend/src/routes/index.js` | Sí | `GET /salud`, `GET /configuracion` y las 6 rutas de entidades |
| `backend/src/config/db.js` | Sí | Pool `mysql2/promise` (`decimalNumbers`, `dateStrings`) |
| `backend/database/script.sql` | Sí | Crea `inventario_bisuteria` con 6 tablas, FK `RESTRICT`, CHECK e índices |
| Otros | `config/env.js`, `config/constantes.js` (`STOCK_MAXIMO = 67`), `middleware/errores.js` (`ErrorHttp`, mensajes de UNIQUE), `middleware/validaciones.js`, `server.js`, `database/seed.js`, `database/db.json`, `pruebas/probar-api.js` |

### 1.2 Tablas reales (MySQL 8)

| Tabla | Columnas |
|---|---|
| categorias | id_categoria, nombre (UNIQUE), descripcion |
| proveedores | id_proveedor, nombre (UNIQUE), contacto, telefono, correo (UNIQUE), direccion |
| materiales | id_material, nombre (UNIQUE), es_hipoalergenico, descripcion |
| empleados | id_empleado, nombre, puesto, telefono, correo (UNIQUE) |
| productos | id_producto, codigo (UNIQUE), nombre, descripcion, precio, stock, id_categoria, id_proveedor, id_material |
| movimientos | id_movimiento, id_producto, id_empleado, tipo (entrada/salida), cantidad, fecha, motivo |

Datos actuales del seed: 5 categorías, 4 proveedores, 6 materiales, 3 empleados (Daniela Rojas, dueña; Mariana Solís, vendedora; Andrés Vargas, encargado de bodega), 9 productos (219 unidades) y 23 movimientos.

### 1.3 Endpoints existentes (todos públicos hoy)

`GET /api/salud`, `GET /api/configuracion` y, para `categorias`, `proveedores`, `materiales`, `empleados`, `productos` y `movimientos`: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.

### 1.4 Reglas del stock (en `backend/src/models/movimientoModel.js`)

- `productos.stock` es la única fuente de verdad; empieza en 0 y no se edita en `productos` (400 si se envía).
- Entrada suma, salida resta; editar revierte y aplica; eliminar revierte; fuera de 0..67 → 409.
- Cada operación usa `enTransaccion` (BEGIN/COMMIT/ROLLBACK) y bloquea el producto con `SELECT ... FOR UPDATE` (`bloquearProducto`).
- `STOCK_MAXIMO` vive solo en `config/constantes.js`; el frontend lo lee de `GET /api/configuracion`.

### 1.5 Componentes de React reutilizables

`Boton`, `CampoFormulario`, `TablaDatos`, `Modal` (centro/lateral, foco y Escape), `ModalConfirmacion`, `EstadoLista` (Cargando, ErrorCarga, SinRegistros), `EncabezadoPagina`, `MigasDePan`, `PaginaAnimada`, `TarjetaProducto`, `FiltrosProductos`, `SeccionFiltro`, `SelectorOrden`, `IndicadorStock`, `GraficoStock`, `CarruselAnuncios`, `FilaDeslizable`, `BuscadorCabecera`, `IconoCategoria`, `PiePagina`, `Layout`.

## 2. Diseño de la integración

### 2.1 Tablas nuevas y cambios (migraciones 001 a 005)

| Migración | Qué agrega |
|---|---|
| 001_usuarios_y_clientes | `usuarios` (correo único, hash, rol, activo, verificaciones, intentos, bloqueo, `id_empleado`/`id_proveedor` como FK únicas) y `clientes` (vinculado 1 a 1 a su usuario) |
| 002_seguridad | `desafios_mfa`, `codigos_verificacion`, `sesiones`, `recuperacion_contrasena` (también para invitaciones) y `auditoria` |
| 003_ventas_y_devoluciones | `productos.costo_unitario` (puede quedar vacío), `ventas`, `detalle_ventas`, `devoluciones`, `detalle_devoluciones` y en `movimientos` las FK opcionales `id_venta` e `id_devolucion` |
| 004_abastecimiento | `solicitudes_abastecimiento`, `detalle_solicitudes_abastecimiento` y `movimientos.id_solicitud` |
| 005_configuracion | `configuracion` (clave/valor) con los ajustes que cambia la dueña |

Todas con PK, FK `RESTRICT` (sin cascada) e índices. `script.sql` queda igual a una base migrada y registra las migraciones como aplicadas.

### 2.2 Roles

| Rol (valor en la base) | Tipo | Vínculo | Panel |
|---|---|---|---|
| `cliente` | externo | fila en `clientes` | Portal del cliente (`/cliente`) |
| `proveedor` | externo | `usuarios.id_proveedor` | Portal del proveedor (`/proveedor`) |
| `ventas` | interno | `usuarios.id_empleado` | Punto de venta (`/pos`) |
| `administrador` | interno | `usuarios.id_empleado` | Panel administrativo (`/admin`) |
| `duena` | interno | `usuarios.id_empleado` | Dashboard ejecutivo (`/duena`) |

Jerarquía interna: duena > administrador > ventas. Se escribe `duena` sin ñ en la base y en el código para evitar problemas de codificación; en pantalla se muestra "Dueña".

### 2.3 Cómo se aplican los permisos

Una sola tabla en `backend/src/config/permisos.js` dice qué roles pueden usar cada `MÉTODO /ruta`. Un único middleware (`autorizar`) la revisa antes de llegar a cualquier ruta:

- Ruta que no está en la tabla → 404 (lo que no está permitido, no existe).
- Ruta pública → pasa.
- Ruta protegida sin sesión completa (contraseña + MFA) → 401.
- Sesión con un rol que no está en la lista → 403.

`docs/matriz-de-permisos.md` se genera desde esa misma tabla con `npm run matriz`, así el documento y el backend no pueden quedar distintos. Las reglas "solo lo suyo" (proveedor, cliente, ventas) se aplican además dentro de los controladores usando los datos de la sesión.

### 2.4 Decisiones de seguridad principales

- Contraseñas: Argon2id (paquete `argon2`). Se instala como dependencia opcional; si en Windows no compilara, el sistema usa bcrypt con costo 12 (`bcryptjs`, JavaScript puro) y lo avisa en la consola.
- Sesiones en MySQL; la cookie `desy_sesion` (HttpOnly, SameSite=Lax, Secure en producción) lleva un token aleatorio y la base guarda solo su hash SHA-256.
- Desafío MFA en otra cookie (`desy_mfa`, 5 minutos) que solo sirve en `/api/auth/mfa/*`.
- Códigos de 6 dígitos con `crypto.randomInt`, guardados como HMAC-SHA256 con `CODIGOS_SECRETO` y comparados con `timingSafeEqual`.
- CSRF con el patrón "doble envío": cookie HttpOnly `desy_csrf` + cabecera `X-CSRF-Token`, obligatorio en POST, PUT, PATCH y DELETE (incluido el login).
- En desarrollo el frontend usa el proxy de Vite (`/api` → `localhost:3000`), así las cookies son del mismo origen.
- Correos con Nodemailer (SMTP del `.env`) y SMS con la API de Twilio por `fetch` (sin SDK, para que se vea exactamente qué se envía).

### 2.5 Ventas, devoluciones y abastecimiento

`movimientoModel.js` se reorganiza para exponer `registrarMovimiento(conexion, datos)`, que bloquea, valida el rango 0..67, inserta y actualiza el stock **dentro de una transacción ya abierta**. Ventas, devoluciones, abastecimiento y el CRUD original usan esa misma función: no hay otra forma de cambiar el stock. Los movimientos creados por una venta, devolución o solicitud quedan vinculados a ella y no se pueden editar ni borrar desde Movimientos (se corrigen con devoluciones).

### 2.6 Pantallas

| # | Pantalla | Ruta | Quién |
|---|---|---|---|
| 1 | Bienvenida | `/` | público |
| 2 | Inicio de sesión | `/login` | público |
| 3 | Registro de clientes | `/registro` (+ `/verificar-correo`) | público |
| 4 | Verificación de dos factores | `/mfa` | contraseña correcta |
| 5 | Recuperar y restablecer contraseña / aceptar invitación | `/recuperar`, `/restablecer`, `/invitacion` | público |
| 6 | Portal del cliente (catálogo, ficha, mis compras) | `/catalogo`, `/catalogo/:id`, `/cliente` | cliente (catálogo también público) |
| 7 | Portal del proveedor | `/proveedor` | proveedor |
| 8 | Punto de venta y mis ventas | `/pos`, `/pos/ventas` | ventas, administrador, dueña |
| 9 | Panel del administrador (y las páginas originales del inventario) | `/admin/...` | administrador, dueña |
| 10 | Dashboard ejecutivo y configuración | `/duena`, `/duena/configuracion` | dueña |
| 11 | Perfil y seguridad | `/perfil` | todos con sesión |

Las páginas originales (productos, movimientos, categorías, proveedores, materiales, empleados, ficha e inicio con gráfico) se conservan y pasan a vivir bajo `/admin/`.
