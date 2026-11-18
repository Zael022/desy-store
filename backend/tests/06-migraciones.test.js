// Pruebas de las migraciones: una base de la versión 1 (con datos) migrada con
// "npm run migrar" debe quedar IGUAL que una base nueva creada con script.sql,
// sin perder datos, y volver a migrar no debe cambiar nada.
import './entorno.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { prepararBase, cerrar } from './ayudante.js';
import { configuracion } from '../src/config/env.js';
import { separarInstrucciones, migrar } from '../database/migrar.js';

const BASE_V1 = 'inv_prueba_migracion_v1';
let conexion;

before(async () => {
  await prepararBase(); // base nueva: script.sql + migrar + seed
  conexion = await mysql.createConnection({ host: configuracion.db.host, port: configuracion.db.puerto, user: configuracion.db.usuario, password: configuracion.db.contrasena });
  await conexion.query(`DROP DATABASE IF EXISTS \`${BASE_V1}\``);
  const v1 = (await fs.readFile(new URL('./datos/esquema-v1.sql', import.meta.url), 'utf8')).replaceAll('inventario_bisuteria', BASE_V1);
  for (const instruccion of separarInstrucciones(v1)) await conexion.query(instruccion);
  // Datos de la versión 1 (como los tendría la tienda antes de actualizar).
  await conexion.query(`INSERT INTO \`${BASE_V1}\`.categorias (nombre) VALUES ('Aretes')`);
  await conexion.query(`INSERT INTO \`${BASE_V1}\`.proveedores (nombre, telefono) VALUES ('Proveedor viejo', '2661-0000')`);
  await conexion.query(`INSERT INTO \`${BASE_V1}\`.materiales (nombre, es_hipoalergenico) VALUES ('Plata', 1)`);
  await conexion.query(`INSERT INTO \`${BASE_V1}\`.empleados (nombre, puesto, correo) VALUES ('Ana', 'Vendedora', 'ana@prueba.test')`);
  await conexion.query(`INSERT INTO \`${BASE_V1}\`.productos (codigo, nombre, precio, stock, id_categoria, id_proveedor, id_material) VALUES ('V1-001', 'Producto v1', 1000, 7, 1, 1, 1)`);
  await conexion.query(`INSERT INTO \`${BASE_V1}\`.movimientos (id_producto, id_empleado, tipo, cantidad, fecha) VALUES (1, 1, 'entrada', 7, '2026-10-01')`);
});

after(async () => {
  await conexion.query(`DROP DATABASE IF EXISTS \`${BASE_V1}\``);
  await conexion.end();
  await cerrar();
});

async function migrarBase(nombre) {
  const original = configuracion.db.nombre;
  configuracion.db.nombre = nombre;
  try {
    return await migrar({ silencioso: true });
  } finally {
    configuracion.db.nombre = original;
  }
}

// "Huella" del esquema: columnas, índices, llaves foráneas y CHECKs.
async function esquema(base) {
  const [columnas] = await conexion.execute(
    `SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`, [base]);
  const [indices] = await conexion.execute(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`, [base]);
  const [foraneas] = await conexion.execute(
    `SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME, UPDATE_RULE, DELETE_RULE
       FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? ORDER BY CONSTRAINT_NAME`, [base]);
  const [checks] = await conexion.execute(
    `SELECT CONSTRAINT_NAME, CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? ORDER BY CONSTRAINT_NAME`, [base]);
  const limpiar = (filas) => filas.map((f) => JSON.stringify(f).replaceAll(base, 'BASE'));
  return { columnas: limpiar(columnas), indices: limpiar(indices), foraneas: limpiar(foraneas), checks: limpiar(checks) };
}

test('Base v1 + migraciones = base nueva con script.sql (mismo esquema exacto)', async () => {
  const resultado = await migrarBase(BASE_V1);
  assert.equal(resultado.aplicadas.length, 8);
  const migrada = await esquema(BASE_V1);
  const nueva = await esquema(configuracion.db.nombre);
  assert.deepEqual(migrada.columnas, nueva.columnas);
  assert.deepEqual(migrada.indices, nueva.indices);
  assert.deepEqual(migrada.foraneas, nueva.foraneas);
  assert.deepEqual(migrada.checks, nueva.checks);
  assert.ok(nueva.columnas.length > 100);
});

test('Migrar otra vez no hace nada y no se pierden los datos de la v1', async () => {
  const segunda = await migrarBase(BASE_V1);
  assert.equal(segunda.aplicadas.length, 0);
  assert.equal(segunda.omitidas.length, 8);
  const [productos] = await conexion.query(`SELECT codigo, stock, costo_unitario FROM \`${BASE_V1}\`.productos`);
  assert.deepEqual(productos, [{ codigo: 'V1-001', stock: 7, costo_unitario: null }]);
  const [movimientos] = await conexion.query(`SELECT COUNT(*) AS total FROM \`${BASE_V1}\`.movimientos`);
  assert.equal(movimientos[0].total, 1);
});

test('Ninguna llave foránea usa CASCADE', async () => {
  const { foraneas } = await esquema(configuracion.db.nombre);
  assert.ok(foraneas.length > 20);
  assert.ok(foraneas.every((f) => !f.includes('CASCADE')), foraneas.filter((f) => f.includes('CASCADE')).join('\n'));
});
