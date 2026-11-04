# Diagrama entidad-relación (completo)

Diagrama complementario con todos los atributos. Los nombres coinciden exactamente con `backend/database/script.sql`.

```mermaid
erDiagram
    categorias ||--o{ productos : "clasifica"
    proveedores ||--o{ productos : "abastece"
    materiales ||--o{ productos : "compone"
    productos ||--o{ movimientos : "registra"
    empleados ||--o{ movimientos : "realiza"

    categorias {
        INT id_categoria PK "AUTO_INCREMENT"
        VARCHAR(60) nombre UK "obligatorio"
        VARCHAR(255) descripcion "opcional"
    }
    proveedores {
        INT id_proveedor PK "AUTO_INCREMENT"
        VARCHAR(100) nombre UK "obligatorio"
        VARCHAR(100) contacto "opcional"
        VARCHAR(20) telefono "obligatorio"
        VARCHAR(100) correo UK "opcional"
        VARCHAR(255) direccion "opcional"
    }
    materiales {
        INT id_material PK "AUTO_INCREMENT"
        VARCHAR(60) nombre UK "obligatorio"
        TINYINT(1) es_hipoalergenico "0 o 1"
        VARCHAR(255) descripcion "opcional"
    }
    empleados {
        INT id_empleado PK "AUTO_INCREMENT"
        VARCHAR(100) nombre "obligatorio"
        VARCHAR(60) puesto "obligatorio"
        VARCHAR(20) telefono "opcional"
        VARCHAR(100) correo UK "obligatorio"
    }
    productos {
        INT id_producto PK "AUTO_INCREMENT"
        VARCHAR(20) codigo UK "obligatorio"
        VARCHAR(100) nombre "obligatorio"
        VARCHAR(255) descripcion "opcional"
        DECIMAL(10_2) precio "mayor o igual a 0"
        INT stock "0 a 67, solo cambia con movimientos"
        INT id_categoria FK "obligatorio"
        INT id_proveedor FK "obligatorio"
        INT id_material FK "obligatorio"
    }
    movimientos {
        INT id_movimiento PK "AUTO_INCREMENT"
        INT id_producto FK "obligatorio"
        INT id_empleado FK "obligatorio"
        ENUM tipo "entrada o salida"
        INT cantidad "mayor que 0"
        DATE fecha "obligatorio"
        VARCHAR(255) motivo "opcional"
    }
```

Notas:

- `UK` = restricción de unicidad (no se puede repetir el valor).
- En Mermaid no se puede escribir una coma dentro del tipo, por eso `DECIMAL(10,2)` aparece como `DECIMAL(10_2)`.
- Todas las llaves foráneas son `ON DELETE RESTRICT` (sin cascada).
