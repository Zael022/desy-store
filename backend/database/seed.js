// =====================================================================
// Seed: carga los datos de ejemplo de db.json en MySQL.
// Se ejecuta desde la carpeta backend con:  npm run seed
// (antes hay que crear la base con script.sql y correr "npm run migrar").
//
// Cómo funciona (en palabras simples):
//   1. Lee db.json.
//   2. Abre UNA conexión y empieza una transacción (todo o nada).
//   3. Recorre las tablas en el orden de las llaves foráneas
//      (primero las tablas "padre", después las "hijas").
//   4. Si un registro ya existe, lo omite (no lo toca: así no sobrescribe lo
//      que usted haya editado). Si no existe, lo inserta.
//   5. Los productos se insertan con stock 0. El stock sale de aplicar los
//      movimientos, igual que en la aplicación (reglas del stock).
//   6. Las ventas, la devolución y las solicitudes de ejemplo se registran con
//      las MISMAS funciones que usa la aplicación (ventaModel, abastecimientoModel),
//      así sus salidas y entradas de inventario son reales y coherentes.
//   7. Al final carga los productos reales de Desy con sus fotos
//      (database/productos-desy.json, ver database/cargar-productos.js).
//   8. Si algo inesperado falla, deshace todo (ROLLBACK).
//
// Cuentas de ejemplo: se crean SIN contraseña (no hay contraseñas publicadas).
// Para usarlas, la dueña reenvía la invitación desde "Usuarios" (personal y
// proveedores) o el cliente usa "Olvidé mi contraseña". En modo consola el
// enlace aparece en la consola del backend.
//
// Se puede ejecutar muchas veces: nunca duplica, nunca borra ni vacía tablas.
// =====================================================================
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pool from '../src/config/db.js';
import { STOCK_MINIMO, STOCK_MAXIMO } from '../src/config/constantes.js';
import { registrarVenta, registrarDevolucion } from '../src/models/ventaModel.js';
import { registrarSolicitud } from '../src/models/abastecimientoModel.js';
import { cargarProductosDesy } from './cargar-productos.js';

// Tablas "simples" en orden de llaves foráneas, con su llave primaria y sus columnas.
// (productos no incluye "stock": siempre empieza en 0).
const TABLAS = [
  { tabla: 'categorias', llave: 'id_categoria', columnas: ['id_categoria', 'nombre', 'descripcion'] },
  { tabla: 'proveedores', llave: 'id_proveedor', columnas: ['id_proveedor', 'nombre', 'contacto', 'telefono', 'correo', 'direccion'] },
  { tabla: 'materiales', llave: 'id_material', columnas: ['id_material', 'nombre', 'es_hipoalergenico', 'descripcion'] },
  { tabla: 'empleados', llave: 'id_empleado', columnas: ['id_empleado', 'nombre', 'puesto', 'telefono', 'correo'] },
  {
    tabla: 'productos',
    llave: 'id_producto',
    columnas: ['id_producto', 'codigo', 'nombre', 'descripcion', 'precio', 'costo_unitario', 'id_categoria', 'id_proveedor', 'id_material']
  }
];

// Errores de MySQL que NO detienen el seed: solo se omite ese registro.
const ERRORES_OMITIBLES = {
  ER_DUP_ENTRY: 'otro registro ya usa ese nombre, código o correo',
  ER_NO_REFERENCED_ROW_2: 'un registro relacionado ya no existe',
  ER_CHECK_CONSTRAINT_VIOLATED: 'los datos no cumplen una regla de la tabla'
};

// Convierte true/false a 1/0 y los campos que faltan a null.
function prepararValor(valor) {
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  return valor === undefined ? null : valor;
}

function nuevoResumen(resumen, tabla) {
  resumen[tabla] = { insertados: 0, omitidos: 0, avisos: [] };
  return resumen[tabla];
}

// Ejecuta "accion" dentro de un SAVEPOINT: si falla por un error omitible,
// se deshace solo ese registro y el seed sigue con los demás.
async function intentar(conexion, r, etiqueta, accion) {
  await conexion.query('SAVEPOINT registro');
  try {
    await accion();
    await conexion.query('RELEASE SAVEPOINT registro');
    r.insertados++;
  } catch (error) {
    await conexion.query('ROLLBACK TO SAVEPOINT registro');
    const motivo = ERRORES_OMITIBLES[error.code] ?? (error.status ? error.message : null);
    if (!motivo) throw error; // error inesperado: se revierte todo
    r.omitidos++;
    r.avisos.push(`${etiqueta} omitido: ${motivo}`);
  }
}

// Inserta los registros de una tabla "simple" (sin reglas de stock).
async function sembrarTabla(conexion, { tabla, llave, columnas }, registros, resumen) {
  const marcadores = columnas.map(() => '?').join(', ');
  const sqlInsertar = tabla === 'productos'
    ? `INSERT INTO productos (${columnas.join(', ')}, stock) VALUES (${marcadores}, 0)`
    : `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${marcadores})`;
  const r = nuevoResumen(resumen, tabla);

  for (const registro of registros) {
    const id = registro[llave];
    const [existentes] = await conexion.execute(`SELECT ${llave} FROM ${tabla} WHERE ${llave} = ?`, [id]);
    if (existentes.length > 0) {
      r.omitidos++;
      continue;
    }
    // Consulta preparada: los "?" se reemplazan de forma segura.
    await intentar(conexion, r, `ID ${id}`, () => conexion.execute(sqlInsertar, columnas.map((c) => prepararValor(registro[c]))));
  }
}

// Inserta los movimientos iniciales aplicando las reglas del stock.
async function sembrarMovimientos(conexion, movimientos, resumen) {
  const r = nuevoResumen(resumen, 'movimientos');
  for (const mov of movimientos) {
    const [existentes] = await conexion.execute('SELECT id_movimiento FROM movimientos WHERE id_movimiento = ?', [mov.id_movimiento]);
    if (existentes.length > 0) {
      r.omitidos++;
      continue;
    }
    const [productos] = await conexion.execute('SELECT stock FROM productos WHERE id_producto = ? FOR UPDATE', [mov.id_producto]);
    const [empleados] = await conexion.execute('SELECT id_empleado FROM empleados WHERE id_empleado = ?', [mov.id_empleado]);
    if (productos.length === 0 || empleados.length === 0) {
      r.omitidos++;
      r.avisos.push(`ID ${mov.id_movimiento} omitido: su producto o empleado no existe.`);
      continue;
    }
    const nuevoStock = productos[0].stock + (mov.tipo === 'entrada' ? mov.cantidad : -mov.cantidad);
    if (nuevoStock < STOCK_MINIMO || nuevoStock > STOCK_MAXIMO) {
      r.omitidos++;
      r.avisos.push(`ID ${mov.id_movimiento} omitido: dejaría el stock del producto ${mov.id_producto} en ${nuevoStock} (permitido de ${STOCK_MINIMO} a ${STOCK_MAXIMO}).`);
      continue;
    }
    await conexion.execute(
      `INSERT INTO movimientos (id_movimiento, id_producto, id_empleado, tipo, cantidad, fecha, motivo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [mov.id_movimiento, mov.id_producto, mov.id_empleado, mov.tipo, mov.cantidad, mov.fecha, prepararValor(mov.motivo)]
    );
    await conexion.execute('UPDATE productos SET stock = ? WHERE id_producto = ?', [nuevoStock, mov.id_producto]);
    r.insertados++;
  }
}

async function idUsuarioPorCorreo(conexion, correo) {
  if (!correo) return null;
  const [filas] = await conexion.execute('SELECT id_usuario, id_empleado FROM usuarios WHERE correo = ?', [correo]);
  return filas[0] || null;
}

// Cuentas internas y de proveedor: SIN contraseña (se activan con la invitación).
async function sembrarUsuarios(conexion, usuarios, resumen) {
  const r = nuevoResumen(resumen, 'usuarios');
  for (const u of usuarios) {
    if (await idUsuarioPorCorreo(conexion, u.correo)) {
      r.omitidos++;
      continue;
    }
    await intentar(conexion, r, u.correo, () =>
      conexion.execute(
        'INSERT INTO usuarios (correo, rol, id_empleado, id_proveedor) VALUES (?, ?, ?, ?)',
        [u.correo, u.rol, u.id_empleado ?? null, u.id_proveedor ?? null]
      )
    );
  }
}

// Clientes de ejemplo: correo verificado, sin contraseña (la definen con "Olvidé mi contraseña").
async function sembrarClientes(conexion, clientes, resumen) {
  const r = nuevoResumen(resumen, 'clientes');
  for (const c of clientes) {
    if (await idUsuarioPorCorreo(conexion, c.correo)) {
      r.omitidos++;
      continue;
    }
    await intentar(conexion, r, c.correo, async () => {
      const [resultado] = await conexion.execute(
        "INSERT INTO usuarios (correo, rol, correo_verificado, telefono) VALUES (?, 'cliente', 1, ?)",
        [c.correo, c.telefono ?? null]
      );
      await conexion.execute('INSERT INTO clientes (id_usuario, nombre, direccion) VALUES (?, ?, ?)', [resultado.insertId, c.nombre, c.direccion ?? null]);
    });
  }
}

async function sembrarVentas(conexion, ventas, resumen) {
  const r = nuevoResumen(resumen, 'ventas');
  for (const v of ventas) {
    const [existentes] = await conexion.execute('SELECT id_venta FROM ventas WHERE clave_idempotencia = ?', [v.clave_idempotencia]);
    if (existentes.length > 0) {
      r.omitidos++;
      continue;
    }
    const vendedor = await idUsuarioPorCorreo(conexion, v.correo_vendedor);
    let idCliente = null;
    if (v.correo_cliente) {
      const [filas] = await conexion.execute('SELECT c.id_cliente FROM clientes c JOIN usuarios u ON u.id_usuario = c.id_usuario WHERE u.correo = ?', [v.correo_cliente]);
      idCliente = filas[0]?.id_cliente ?? null;
    }
    if (!vendedor || !vendedor.id_empleado) {
      r.omitidos++;
      r.avisos.push(`Venta ${v.clave_idempotencia} omitida: la cuenta del vendedor no existe.`);
      continue;
    }
    await intentar(conexion, r, `Venta ${v.clave_idempotencia}`, () =>
      registrarVenta(conexion, {
        clave: v.clave_idempotencia,
        idUsuario: vendedor.id_usuario,
        idEmpleado: vendedor.id_empleado,
        idCliente,
        nota: v.nota,
        items: v.items,
        fecha: v.fecha
      })
    );
  }
}

async function sembrarDevoluciones(conexion, devoluciones, resumen) {
  const r = nuevoResumen(resumen, 'devoluciones');
  for (const d of devoluciones) {
    const [existentes] = await conexion.execute('SELECT id_devolucion FROM devoluciones WHERE id_devolucion = ?', [d.id_devolucion]);
    if (existentes.length > 0) {
      r.omitidos++;
      continue;
    }
    const [ventas] = await conexion.execute('SELECT id_venta FROM ventas WHERE clave_idempotencia = ?', [d.clave_venta]);
    const usuario = await idUsuarioPorCorreo(conexion, d.correo_usuario);
    if (ventas.length === 0 || !usuario) {
      r.omitidos++;
      r.avisos.push(`Devolución ${d.id_devolucion} omitida: su venta o su usuario no existe.`);
      continue;
    }
    const [lineas] = await conexion.execute('SELECT id_detalle_venta, id_producto FROM detalle_ventas WHERE id_venta = ?', [ventas[0].id_venta]);
    const items = d.items.map((item) => ({
      id_detalle_venta: lineas.find((l) => l.id_producto === item.id_producto)?.id_detalle_venta,
      cantidad: item.cantidad
    }));
    await intentar(conexion, r, `Devolución ${d.id_devolucion}`, () =>
      registrarDevolucion(conexion, {
        idVenta: ventas[0].id_venta,
        idUsuario: usuario.id_usuario,
        idEmpleado: usuario.id_empleado,
        motivo: d.motivo,
        items,
        fecha: d.fecha
      })
    );
  }
}

async function sembrarSolicitudes(conexion, solicitudes, resumen) {
  const r = nuevoResumen(resumen, 'solicitudes_abastecimiento');
  for (const s of solicitudes) {
    const [existentes] = await conexion.execute('SELECT id_solicitud FROM solicitudes_abastecimiento WHERE id_solicitud = ?', [s.id_solicitud]);
    if (existentes.length > 0) {
      r.omitidos++;
      continue;
    }
    const creador = await idUsuarioPorCorreo(conexion, s.correo_creador);
    if (!creador) {
      r.omitidos++;
      r.avisos.push(`Solicitud ${s.id_solicitud} omitida: la cuenta que la crea no existe.`);
      continue;
    }
    await intentar(conexion, r, `Solicitud ${s.id_solicitud}`, () =>
      registrarSolicitud(conexion, { idProveedor: s.id_proveedor, idUsuario: creador.id_usuario, nota: s.nota_tienda, items: s.items })
    );
  }
}

function mostrarResumen(resumen) {
  console.log('\nResumen del seed:');
  for (const [tabla, datos] of Object.entries(resumen)) {
    console.log(`  - ${tabla.padEnd(27)} insertados: ${datos.insertados}, omitidos (ya existían): ${datos.omitidos}`);
    for (const aviso of datos.avisos) console.log(`      aviso: ${aviso}`);
  }
}

// Función reutilizable (la usan también las pruebas automáticas).
export async function sembrar({ silencioso = false } = {}) {
  const datos = JSON.parse(await fs.readFile(new URL('./db.json', import.meta.url), 'utf8'));
  const conexion = await pool.getConnection();
  const resumen = {};
  try {
    await conexion.beginTransaction();
    for (const configuracion of TABLAS) {
      await sembrarTabla(conexion, configuracion, datos[configuracion.tabla] || [], resumen);
    }
    await sembrarMovimientos(conexion, datos.movimientos || [], resumen);
    await sembrarUsuarios(conexion, datos.usuarios || [], resumen);
    await sembrarClientes(conexion, datos.clientes || [], resumen);
    await sembrarVentas(conexion, datos.ventas || [], resumen);
    await sembrarDevoluciones(conexion, datos.devoluciones || [], resumen);
    await sembrarSolicitudes(conexion, datos.solicitudes_abastecimiento || [], resumen);
    // Productos reales de Desy con fotos y subcategorías (database/productos-desy.json).
    await cargarProductosDesy(conexion, resumen);
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
  if (!silencioso) {
    mostrarResumen(resumen);
    const [stocks] = await pool.query('SELECT codigo, nombre, stock FROM productos ORDER BY id_producto');
    console.log(`\nStock actual de los productos (máximo ${STOCK_MAXIMO}):`);
    for (const p of stocks) console.log(`  ${p.codigo.padEnd(12)} ${String(p.stock).padStart(3)}  ${p.nombre}`);
    console.log('\nLas cuentas de ejemplo no tienen contraseña. Cree la dueña con "npm run crear-duena" y desde Usuarios reenvíe las invitaciones.');
    console.log('Seed terminado correctamente.');
  }
  return resumen;
}

// Solo se ejecuta solo si se llama directamente (npm run seed), no al importarlo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  sembrar()
    .catch((error) => {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        console.error('\nFaltan tablas o columnas nuevas. Ejecute primero "npm run migrar".');
      }
      console.error('\nEl seed falló y se revirtieron TODOS los cambios.');
      console.error(`Motivo: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
