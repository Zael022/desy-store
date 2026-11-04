# Tema y justificación

**Tema:** Sistema de inventario para una tienda de bisutería y accesorios.

**Empresa:** Desy, tienda de bisutería y accesorios.

## Problema de la empresa

Desy vende aretes, collares, pulseras, anillos y accesorios para el cabello que compra a varios proveedores. Hoy lleva el control en cuadernos y mensajes, y eso causa problemas:

- No sabe con certeza cuántas unidades le quedan de cada producto.
- No sabe a qué proveedor volver a pedir algo que se agotó.
- No queda registro de quién sacó o ingresó mercadería, ni cuándo, ni por qué.
- Los clientes preguntan si una pieza es hipoalergénica y no siempre se sabe de qué material es.
- El espacio de exhibición y bodega es pequeño, por lo que la dueña decidió no tener más de 67 unidades de un mismo producto.

## Cómo la ayuda el sistema

- Guarda en un solo lugar los productos con su categoría, proveedor y material.
- Calcula el stock automáticamente a partir de las entradas y salidas, sin que nadie lo escriba a mano.
- Impide registrar una salida si no hay unidades suficientes, o una entrada que pase del máximo de 67.
- Deja un historial de movimientos con fecha, motivo y el empleado que lo registró.
- Muestra un gráfico del stock de cada producto comparado con el máximo.

## Quién usará la aplicación

La dueña y las personas que atienden la tienda (vendedoras y encargada de bodega), desde la computadora del local o desde el celular.

## Funcionalidades incluidas

- CRUD completo (crear, consultar, editar y eliminar) de categorías, proveedores, materiales, empleados, productos y movimientos de inventario.
- Control del stock entre 0 y 67 unidades mediante movimientos, con transacciones.
- Mensajes claros cuando algo no se puede hacer (datos inválidos, duplicados, registros con dependencias, límites del stock).
- Catálogo de productos con buscador, filtros y orden, y una ficha por producto desde la que se registran entradas y salidas.
- Página de inicio con anuncios, categorías, productos con poco stock, resumen y gráfico de stock por producto.

## Fuera del alcance

- Inicio de sesión, usuarios, contraseñas, roles o permisos.
- Ventas con factura, caja, pagos en línea o servicios externos.
- Fotos de los productos.
- Reportes en PDF o Excel.
- Varias sucursales o bodegas.
