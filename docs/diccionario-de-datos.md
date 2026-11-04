# Diccionario de datos

Base de datos: `inventario_bisuteria` (MySQL 8, `utf8mb4`, motor InnoDB).

Convenciones:

- **PK**: llave primaria. **FK**: llave foránea. **UK**: valor único.
- Las comparaciones de texto no distinguen mayúsculas ni tildes (`utf8mb4_0900_ai_ci`): "Aretes" y "aretes" cuentan como el mismo nombre.
- Los textos se guardan sin espacios al inicio ni al final. Un texto opcional vacío se guarda como `NULL`.

## 1. categorias

Tipo de producto (aretes, collares, pulseras...).

| Campo | Tipo | Obligatorio | Llave | Restricciones |
|---|---|---|---|---|
| id_categoria | INT UNSIGNED | Sí (automático) | PK | AUTO_INCREMENT |
| nombre | VARCHAR(60) | Sí | UK | 1 a 60 caracteres, no solo espacios |
| descripcion | VARCHAR(255) | No | | Máximo 255 caracteres |

## 2. proveedores

Personas o empresas a las que se les compra mercadería.

| Campo | Tipo | Obligatorio | Llave | Restricciones |
|---|---|---|---|---|
| id_proveedor | INT UNSIGNED | Sí (automático) | PK | AUTO_INCREMENT |
| nombre | VARCHAR(100) | Sí | UK | 1 a 100 caracteres |
| contacto | VARCHAR(100) | No | | Persona de contacto, máximo 100 |
| telefono | VARCHAR(20) | Sí | | 8 a 20 caracteres; solo dígitos, espacios, guiones, `+` y paréntesis |
| correo | VARCHAR(100) | No | UK | Formato de correo válido, máximo 100 |
| direccion | VARCHAR(255) | No | | Máximo 255 |

## 3. materiales

De qué está hecho cada producto.

| Campo | Tipo | Obligatorio | Llave | Restricciones |
|---|---|---|---|---|
| id_material | INT UNSIGNED | Sí (automático) | PK | AUTO_INCREMENT |
| nombre | VARCHAR(60) | Sí | UK | 1 a 60 caracteres |
| es_hipoalergenico | TINYINT(1) | Sí | | Solo 0 (no) o 1 (sí). La API recibe `true`/`false` |
| descripcion | VARCHAR(255) | No | | Máximo 255 |

## 4. empleados

Personas que registran los movimientos (no son usuarios con contraseña).

| Campo | Tipo | Obligatorio | Llave | Restricciones |
|---|---|---|---|---|
| id_empleado | INT UNSIGNED | Sí (automático) | PK | AUTO_INCREMENT |
| nombre | VARCHAR(100) | Sí | | 1 a 100 caracteres |
| puesto | VARCHAR(60) | Sí | | 1 a 60 caracteres |
| telefono | VARCHAR(20) | No | | Mismo formato que en proveedores |
| correo | VARCHAR(100) | Sí | UK | Formato de correo válido |

## 5. productos

Artículos que vende la tienda.

| Campo | Tipo | Obligatorio | Llave | Restricciones |
|---|---|---|---|---|
| id_producto | INT UNSIGNED | Sí (automático) | PK | AUTO_INCREMENT |
| codigo | VARCHAR(20) | Sí | UK | 1 a 20 caracteres; letras, números y guiones (ej. `ARE-001`) |
| nombre | VARCHAR(100) | Sí | | 1 a 100 caracteres |
| descripcion | VARCHAR(255) | No | | Máximo 255 |
| precio | DECIMAL(10,2) | Sí | | Número entre 0 y 99 999 999.99, máximo 2 decimales (colones) |
| stock | INT | Sí (automático) | | Empieza en 0. Entre 0 y 67. **No se edita directamente** |
| id_categoria | INT UNSIGNED | Sí | FK → categorias | Debe existir |
| id_proveedor | INT UNSIGNED | Sí | FK → proveedores | Debe existir |
| id_material | INT UNSIGNED | Sí | FK → materiales | Debe existir |

## 6. movimientos

Cada entrada o salida de mercadería.

| Campo | Tipo | Obligatorio | Llave | Restricciones |
|---|---|---|---|---|
| id_movimiento | INT UNSIGNED | Sí (automático) | PK | AUTO_INCREMENT |
| id_producto | INT UNSIGNED | Sí | FK → productos | Debe existir |
| id_empleado | INT UNSIGNED | Sí | FK → empleados | Debe existir |
| tipo | ENUM('entrada','salida') | Sí | | Solo esos dos valores |
| cantidad | INT | Sí | | Entero entre 1 y 67 |
| fecha | DATE | Sí | | Fecha real con formato `AAAA-MM-DD` |
| motivo | VARCHAR(255) | No | | Máximo 255 (ej. "Venta en tienda") |

## Relaciones y cardinalidades

| Relación | Cardinalidad | Regla de eliminación |
|---|---|---|
| categorias → productos | 1 a muchos (una categoría tiene 0..N productos; un producto tiene 1 categoría) | RESTRICT: no se borra una categoría con productos (409) |
| proveedores → productos | 1 a muchos | RESTRICT (409) |
| materiales → productos | 1 a muchos | RESTRICT (409) |
| productos → movimientos | 1 a muchos | RESTRICT: no se borra un producto con movimientos (409) |
| empleados → movimientos | 1 a muchos | RESTRICT (409) |

No hay eliminaciones en cascada (`ON DELETE RESTRICT` y `ON UPDATE RESTRICT` en todas las FK).

## Reglas del stock

1. El stock se guarda solo en `productos.stock`; es la única fuente de verdad.
2. Mínimo 0, máximo 67. El 67 está en una sola constante: `STOCK_MAXIMO` en `backend/src/config/constantes.js`. El frontend lo pide a la API en `GET /api/configuracion`.
3. Un producto nuevo empieza con stock 0. El formulario de productos no tiene campo de stock y la API rechaza (400) un `stock` enviado en `POST` o `PUT /api/productos`.
4. Crear un movimiento de **entrada** suma `cantidad`; uno de **salida** la resta.
5. Editar un movimiento revierte su efecto anterior y aplica el nuevo (también si se cambia de producto).
6. Eliminar un movimiento revierte su efecto.
7. Si el resultado quedara por debajo de 0 o por encima de 67, la operación se rechaza con **409** y un mensaje claro.
8. Cada operación de movimientos modifica dos tablas (`movimientos` y `productos`), por eso usa una **transacción**: si algo falla, se deshace todo.
9. El seed también respeta estas reglas: inserta los productos con stock 0 y el stock sale de aplicar los movimientos de `db.json`.

Decisión: el CHECK de la base de datos solo protege el mínimo (`stock >= 0`). El máximo no se repite en SQL para que el 67 exista en un único lugar.
