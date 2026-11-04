// =====================================================================
// Seed: carga los datos iniciales de db.json en MySQL.
// Se ejecuta desde la carpeta backend con:  npm run seed
//
// Cómo funciona (en palabras simples):
//   1. Lee db.json.
//   2. Abre UNA conexión y empieza una transacción (todo o nada).
//   3. Recorre las tablas en el orden de las llaves foráneas
//      (primero las tablas "padre", después las "hijas").
//   4. Para cada registro: si su ID ya existe, lo omite (no lo toca, así
//      no sobrescribe lo que usted haya editado). Si no existe, lo inserta.
//   5. Los productos se insertan con stock 0. El stock sale de aplicar los
//      movimientos, igual que en la aplicación (reglas del stock).
//   6. Si algo inesperado falla, deshace todo (ROLLBACK).
//   7. Muestra un resumen y cierra las conexiones.
//
// Se puede ejecutar muchas veces: nunca duplica, nunca borra ni vacía tablas.
// Si usted borró un registro inicial, lo vuelve a crear.
// =====================================================================
import fs from 'node:fs/promises';
import pool from '../src/config/db.js';
import { STOCK_MINIMO, STOCK_MAXIMO } from '../src/config/constantes.js';

// Tablas en orden de llaves foráneas, con su llave primaria y sus columnas.
// (productos no incluye "stock": siempre empieza en 0).
const TABLAS = [
  { tabla: 'categorias', llave: 'id_categoria', columnas: ['id_categoria', 'nombre', 'descripcion'] },
  { tabla: 'proveedores', llave: 'id_proveedor', columnas: ['id_proveedor', 'nombre', 'contacto', 'telefono', 'correo', 'direccion'] },
  { tabla: 'materiales', llave: 'id_material', columnas: ['id_material', 'nombre', 'es_hipoalergenico', 'descripcion'] },
  { tabla: 'empleados', llave: 'id_empleado', columnas: ['id_empleado', 'nombre', 'puesto', 'telefono', 'correo'] },
  {
    tabla: 'productos',
    llave: 'id_producto',
    columnas: ['id_producto', 'codigo', 'nombre', 'descripcion', 'precio', 'id_categoria', 'id_proveedor', 'id_material']
  }
];

// Errores de MySQL que NO detienen el seed: solo se omite ese registro.
const ERRORES_OMITIBLES = {
  ER_DUP_ENTRY: 'otro registro ya usa ese nombre, código o correo',
  ER_NO_REFERENCED_ROW_2: 'un registro relacionado ya no existe'
};

// Convierte true/false a 1/0 y los campos que faltan a null.
function prepararValor(valor) {
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  return valor === undefined ? null : valor;
}

// Inserta los registros de una tabla "simple" (sin reglas de stock).
async function sembrarTabla(conexion, { tabla, llave, columnas }, registros, resumen) {
  const marcadores = columnas.map(() => '?').join(', ');
  // En productos agregamos "stock = 0" de forma explícita.
  const sqlInsertar = tabla === 'productos'
    ? `INSERT INTO productos (${columnas.join(', ')}, stock) VALUES (${marcadores}, 0)`
    : `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${marcadores})`;

  resumen[tabla] = { insertados: 0, omitidos: 0, avisos: [] };

  for (const registro of registros) {
    const id = registro[llave];

    // 1. ¿Ya existe un registro con ese ID? Entonces no se toca.
    const [existentes] = await conexion.execute(`SELECT ${llave} FROM ${tabla} WHERE ${llave} = ?`, [id]);
    if (existentes.length > 0) {
      resumen[tabla].omitidos++;
      continue;
    }

    // 2. No existe: se inserta con consulta preparada (los "?" se reemplazan de forma segura).
    const valores = columnas.map((columna) => prepararValor(registro[columna]));
    try {
      await conexion.execute(sqlInsertar, valores);
      resumen[tabla].insertados++;
    } catch (error) {
      if (ERRORES_OMITIBLES[error.code]) {
        resumen[tabla].omitidos++;
        resumen[tabla].avisos.push(`ID ${id} omitido: ${ERRORES_OMITIBLES[error.code]}.`);
      } else {
        throw error; // error inesperado: se revierte todo
      }
    }
  }
}

// Inserta los movimientos aplicando las reglas del stock.
async function sembrarMovimientos(conexion, movimientos, resumen) {
  resumen.movimientos = { insertados: 0, omitidos: 0, avisos: [] };

  for (const mov of movimientos) {
    const [existentes] = await conexion.execute(
      'SELECT id_movimiento FROM movimientos WHERE id_movimiento = ?',
      [mov.id_movimiento]
    );
    if (existentes.length > 0) {
      resumen.movimientos.omitidos++;
      continue;
    }

    // Bloquea la fila del producto (FOR UPDATE) mientras calculamos su stock.
    const [productos] = await conexion.execute(
      'SELECT stock FROM productos WHERE id_producto = ? FOR UPDATE',
      [mov.id_producto]
    );
    const [empleados] = await conexion.execute(
      'SELECT id_empleado FROM empleados WHERE id_empleado = ?',
      [mov.id_empleado]
    );
    if (productos.length === 0 || empleados.length === 0) {
      resumen.movimientos.omitidos++;
      resumen.movimientos.avisos.push(`ID ${mov.id_movimiento} omitido: su producto o empleado no existe.`);
      continue;
    }

    const efecto = mov.tipo === 'entrada' ? mov.cantidad : -mov.cantidad;
    const nuevoStock = productos[0].stock + efecto;
    if (nuevoStock < STOCK_MINIMO || nuevoStock > STOCK_MAXIMO) {
      resumen.movimientos.omitidos++;
      resumen.movimientos.avisos.push(
        `ID ${mov.id_movimiento} omitido: dejaría el stock del producto ${mov.id_producto} en ${nuevoStock} (permitido de ${STOCK_MINIMO} a ${STOCK_MAXIMO}).`
      );
      continue;
    }

    await conexion.execute(
      `INSERT INTO movimientos (id_movimiento, id_producto, id_empleado, tipo, cantidad, fecha, motivo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [mov.id_movimiento, mov.id_producto, mov.id_empleado, mov.tipo, mov.cantidad, mov.fecha, prepararValor(mov.motivo)]
    );
    await conexion.execute('UPDATE productos SET stock = ? WHERE id_producto = ?', [nuevoStock, mov.id_producto]);
    resumen.movimientos.insertados++;
  }
}

function mostrarResumen(resumen) {
  console.log('\nResumen del seed:');
  for (const [tabla, datos] of Object.entries(resumen)) {
    console.log(`  - ${tabla.padEnd(12)} insertados: ${datos.insertados}, omitidos (ya existían): ${datos.omitidos}`);
    for (const aviso of datos.avisos) console.log(`      aviso: ${aviso}`);
  }
}

async function ejecutarSeed() {
  const contenido = await fs.readFile(new URL('./db.json', import.meta.url), 'utf8');
  const datos = JSON.parse(contenido);

  const conexion = await pool.getConnection();
  const resumen = {};
  try {
    await conexion.beginTransaction();

    for (const configuracion of TABLAS) {
      await sembrarTabla(conexion, configuracion, datos[configuracion.tabla] || [], resumen);
    }
    await sembrarMovimientos(conexion, datos.movimientos || [], resumen);

    await conexion.commit();
    mostrarResumen(resumen);

    const [stocks] = await conexion.query('SELECT codigo, nombre, stock FROM productos ORDER BY id_producto');
    console.log(`\nStock actual de los productos (máximo ${STOCK_MAXIMO}):`);
    for (const p of stocks) console.log(`  ${p.codigo.padEnd(8)} ${String(p.stock).padStart(3)}  ${p.nombre}`);
    console.log('\nSeed terminado correctamente.');
  } catch (error) {
    await conexion.rollback();
    console.error('\nEl seed falló y se revirtieron TODOS los cambios.');
    console.error(`Motivo: ${error.message}`);
    process.exitCode = 1;
  } finally {
    conexion.release();
    await pool.end(); // cierra todas las conexiones para que el proceso termine
  }
}

ejecutarSeed().catch(async (error) => {
  // Por ejemplo: no se pudo conectar a MySQL o db.json tiene un error de formato.
  console.error('No se pudo ejecutar el seed:', error.message);
  process.exitCode = 1;
  await pool.end().catch(() => {});
});
