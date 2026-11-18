// =====================================================================
// Carga los productos reales de Desy (database/productos-desy.json) con sus fotos.
//
// Se ejecuta solo con:   npm run cargar-productos
// y también al final de: npm run seed
// (antes hay que correr "npm run migrar" para tener las subcategorías y las fotos).
//
// Cómo funciona (en palabras simples):
//   1. Crea las categorías y subcategorías que falten (Crochet > Peluches...).
//      Se buscan por NOMBRE: si ya existe una con ese nombre, se usa esa.
//   2. Crea los materiales que falten (también por nombre).
//   3. Por cada producto: si ya existe uno con ese código, NO lo toca (así no
//      pisa lo que usted haya cambiado). Si no existe:
//        - lo crea con stock 0,
//        - le agrega sus fotos (copiándolas de database/fotos a la carpeta de fotos);
//          las de "fotos_medidas" quedan marcadas como fotos con medidas, al final,
//        - y registra su stock inicial como una ENTRADA en Movimientos
//          (el stock solo cambia con movimientos, igual que en la aplicación).
//   4. Si alguna foto inicial falta en la carpeta de fotos (por ejemplo, en una
//      computadora nueva), la vuelve a copiar.
// Todo pasa en una transacción: si algo falla, no queda nada a medias.
// =====================================================================
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pool from '../src/config/db.js';
import { registrarMovimiento } from '../src/models/movimientoModel.js';
import { copiarFotoInicial } from '../src/servicios/fotos.js';

const MOTIVO_INICIAL = 'Inventario inicial (productos de Desy)';

async function leerDatos() {
  return JSON.parse(await fs.readFile(new URL('./productos-desy.json', import.meta.url), 'utf8'));
}

async function idPorNombre(conexion, tabla, llave, nombre) {
  const [filas] = await conexion.execute(`SELECT ${llave} FROM ${tabla} WHERE nombre = ?`, [nombre]);
  return filas[0]?.[llave] ?? null;
}

async function cargarCategorias(conexion, categorias, r) {
  for (const c of categorias) {
    if (await idPorNombre(conexion, 'categorias', 'id_categoria', c.nombre)) {
      r.omitidos++;
      continue;
    }
    const idPadre = c.padre ? await idPorNombre(conexion, 'categorias', 'id_categoria', c.padre) : null;
    if (c.padre && !idPadre) {
      r.avisos.push(`La categoría "${c.nombre}" se creó como principal porque no existe "${c.padre}".`);
    }
    await conexion.execute('INSERT INTO categorias (nombre, descripcion, id_categoria_padre) VALUES (?, ?, ?)', [c.nombre, c.descripcion ?? null, idPadre]);
    r.insertados++;
  }
}

async function cargarMateriales(conexion, materiales, r) {
  for (const m of materiales) {
    if (await idPorNombre(conexion, 'materiales', 'id_material', m.nombre)) {
      r.omitidos++;
      continue;
    }
    await conexion.execute('INSERT INTO materiales (nombre, es_hipoalergenico, descripcion) VALUES (?, ?, ?)', [m.nombre, m.es_hipoalergenico ? 1 : 0, m.descripcion ?? null]);
    r.insertados++;
  }
}

// Empleado que registra las entradas iniciales: el de la dueña si ya tiene cuenta;
// si no, el primer empleado. (null si no hay empleados)
async function empleadoParaMovimientos(conexion) {
  const [duena] = await conexion.query("SELECT id_empleado FROM usuarios WHERE rol = 'duena' AND id_empleado IS NOT NULL ORDER BY id_usuario LIMIT 1");
  if (duena.length > 0) return duena[0].id_empleado;
  const [primero] = await conexion.query('SELECT id_empleado FROM empleados ORDER BY id_empleado LIMIT 1');
  return primero[0]?.id_empleado ?? null;
}

async function cargarProductos(conexion, productos, r, rFotos) {
  const idEmpleado = await empleadoParaMovimientos(conexion);
  const [proveedores] = await conexion.query('SELECT id_proveedor FROM proveedores ORDER BY id_proveedor LIMIT 1');
  const proveedorDeRespaldo = proveedores[0]?.id_proveedor ?? null;
  const hoy = new Date().toISOString().slice(0, 10);

  for (const p of productos) {
    const [existe] = await conexion.execute('SELECT id_producto FROM productos WHERE codigo = ?', [p.codigo]);
    if (existe.length > 0) {
      r.omitidos++;
      continue;
    }
    const idCategoria = await idPorNombre(conexion, 'categorias', 'id_categoria', p.categoria);
    const idMaterial = await idPorNombre(conexion, 'materiales', 'id_material', p.material);
    let idProveedor = await idPorNombre(conexion, 'proveedores', 'id_proveedor', p.proveedor);
    if (!idProveedor && proveedorDeRespaldo) {
      idProveedor = proveedorDeRespaldo;
      r.avisos.push(`${p.codigo}: no existe el proveedor "${p.proveedor}"; se asignó el proveedor #${idProveedor} (cámbielo en Productos).`);
    }
    if (!idCategoria || !idMaterial || !idProveedor) {
      r.omitidos++;
      r.avisos.push(`${p.codigo} omitido: falta su categoría, material o proveedor.`);
      continue;
    }

    const [resultado] = await conexion.execute(
      `INSERT INTO productos (codigo, nombre, descripcion, precio, costo_unitario, stock, id_categoria, id_proveedor, id_material)
       VALUES (?, ?, ?, ?, NULL, 0, ?, ?, ?)`,
      [p.codigo, p.nombre, p.descripcion ?? null, p.precio, idCategoria, idProveedor, idMaterial]
    );
    const idProducto = resultado.insertId;
    r.insertados++;

    // Fotos: primero se copia el archivo y, si existe, se anota en la base.
    // Primero las normales (la primera es la principal) y al final las que tienen medidas.
    const fotos = [...(p.fotos ?? []).map((archivo) => ({ archivo, medidas: 0 })), ...(p.fotos_medidas ?? []).map((archivo) => ({ archivo, medidas: 1 }))];
    let orden = 0;
    for (const { archivo, medidas } of fotos) {
      if (!(await copiarFotoInicial(archivo))) {
        rFotos.avisos.push(`${p.codigo}: no se encontró database/fotos/${archivo}.`);
        continue;
      }
      orden++;
      await conexion.execute('INSERT INTO producto_fotos (id_producto, archivo, orden, es_de_medidas) VALUES (?, ?, ?, ?)', [idProducto, archivo, orden, medidas]);
      rFotos.insertados++;
    }

    // Stock inicial = una entrada real en Movimientos.
    if (p.stock_inicial > 0) {
      if (!idEmpleado) {
        r.avisos.push(`${p.codigo}: quedó con stock 0 porque no hay empleados para registrar la entrada.`);
        continue;
      }
      await registrarMovimiento(conexion, { id_producto: idProducto, id_empleado: idEmpleado, tipo: 'entrada', cantidad: p.stock_inicial, fecha: hoy, motivo: MOTIVO_INICIAL });
    }
  }
}

// Vuelve a copiar las fotos iniciales que estén en la base pero no en la carpeta.
async function repararFotos(conexion, rFotos) {
  const [fotos] = await conexion.query('SELECT archivo FROM producto_fotos');
  for (const { archivo } of fotos) {
    // copiarFotoInicial no hace nada si ya está o si no es una foto inicial.
    await copiarFotoInicial(archivo);
  }
  rFotos.omitidos = fotos.length - rFotos.insertados;
}

// Se puede llamar con una conexión que ya tiene una transacción abierta (el seed lo hace).
export async function cargarProductosDesy(conexion, resumen = {}) {
  const datos = await leerDatos();
  const nuevo = () => ({ insertados: 0, omitidos: 0, avisos: [] });
  resumen.categorias_desy = nuevo();
  resumen.materiales_desy = nuevo();
  resumen.productos_desy = nuevo();
  resumen.fotos_de_productos = nuevo();
  await cargarCategorias(conexion, datos.categorias ?? [], resumen.categorias_desy);
  await cargarMateriales(conexion, datos.materiales ?? [], resumen.materiales_desy);
  await cargarProductos(conexion, datos.productos ?? [], resumen.productos_desy, resumen.fotos_de_productos);
  await repararFotos(conexion, resumen.fotos_de_productos);
  return resumen;
}

// Solo se ejecuta si se llama directamente (npm run cargar-productos).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resumen = await cargarProductosDesy(conexion);
    await conexion.commit();
    console.log('Productos de Desy:');
    for (const [nombre, datos] of Object.entries(resumen)) {
      console.log(`  - ${nombre.padEnd(20)} nuevos: ${datos.insertados}, ya existían: ${datos.omitidos}`);
      for (const aviso of datos.avisos) console.log(`      aviso: ${aviso}`);
    }
    console.log('Listo. Las fotos están en la carpeta backend/uploads/productos.');
  } catch (error) {
    await conexion.rollback();
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('Faltan tablas o columnas nuevas. Ejecute primero "npm run migrar".');
    }
    console.error(`No se cargaron los productos (no se guardó nada). Motivo: ${error.message}`);
    process.exitCode = 1;
  } finally {
    conexion.release();
    await pool.end();
  }
}
