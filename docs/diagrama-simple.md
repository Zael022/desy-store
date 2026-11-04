# Diagrama entidad-relación (simple)

Diagrama principal del proyecto: solo tablas, llaves primarias (PK), llaves foráneas (FK) y relaciones.

```mermaid
erDiagram
    categorias ||--o{ productos : "clasifica"
    proveedores ||--o{ productos : "abastece"
    materiales ||--o{ productos : "compone"
    productos ||--o{ movimientos : "registra"
    empleados ||--o{ movimientos : "realiza"

    categorias {
        INT id_categoria PK
    }
    proveedores {
        INT id_proveedor PK
    }
    materiales {
        INT id_material PK
    }
    empleados {
        INT id_empleado PK
    }
    productos {
        INT id_producto PK
        INT id_categoria FK
        INT id_proveedor FK
        INT id_material FK
    }
    movimientos {
        INT id_movimiento PK
        INT id_producto FK
        INT id_empleado FK
    }
```

## Cómo leer las líneas

- `||--o{` significa "uno a muchos": una categoría puede tener cero o muchos productos, y cada producto pertenece a exactamente una categoría.
- Lo mismo para proveedores, materiales, productos → movimientos y empleados → movimientos.

Para ver todos los atributos, abra [diagrama-completo.md](diagrama-completo.md).
