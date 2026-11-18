// =====================================================================
// Ejecutor de migraciones: npm run migrar  (desde la carpeta backend)
//
// Una "migración" es un archivo .sql numerado (001_..., 002_...) que
// actualiza una base que ya existe SIN borrar datos.
//
// Cómo funciona:
//   1. Crea (si no existe) la tabla migraciones_aplicadas, que anota cuáles ya se aplicaron.
//   2. Lee los archivos de database/migraciones en orden por su número.
//   3. Para cada migración que no está anotada, ejecuta sus instrucciones una por una.
//      Si una instrucción dice "ya existe" (tabla, columna, índice o llave), se salta:
//      así se puede correr muchas veces y también sobre una base creada con script.sql nuevo.
//   4. Anota la migración como aplicada.
//
// Importante: MySQL no puede deshacer cambios de estructura (CREATE/ALTER),
// por eso cada instrucción se aplica por separado y, si alguna falla con
// un error distinto de "ya existe", el proceso se detiene y explica cuál fue.
// =====================================================================
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { configuracion } from '../src/config/env.js';

const CARPETA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migraciones');

// Errores de MySQL que significan "esto ya estaba hecho".
const ERRORES_YA_EXISTE = new Set([
  'ER_TABLE_EXISTS_ERROR', // la tabla ya existe
  'ER_DUP_FIELDNAME', // la columna ya existe
  'ER_DUP_KEYNAME', // el índice ya existe
  'ER_FK_DUP_NAME', // la llave foránea ya existe
  'ER_CHECK_CONSTRAINT_DUP_NAME' // la restricción CHECK ya existe
]);

// Separa un archivo .sql en instrucciones (quita los comentarios que empiezan con --).
// Regla para quien escriba migraciones: cada instrucción termina con ; al final de la línea
// y ningún texto entre comillas puede tener un ; seguido de un salto de línea.
export function separarInstrucciones(textoSql) {
  const sinComentarios = textoSql
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('--'))
    .join('\n');
  return sinComentarios
    .split(/;\s*(?:\n|$)/)
    .map((instruccion) => instruccion.trim())
    .filter((instruccion) => instruccion.length > 0);
}

export async function migrar({ silencioso = false } = {}) {
  const mostrar = (texto) => !silencioso && console.log(texto);
  const conexion = await mysql.createConnection({
    host: configuracion.db.host,
    port: configuracion.db.puerto,
    user: configuracion.db.usuario,
    password: configuracion.db.contrasena,
    database: configuracion.db.nombre
  });

  try {
    await conexion.query(`CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
      nombre      VARCHAR(100) NOT NULL,
      aplicada_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT pk_migraciones_aplicadas PRIMARY KEY (nombre)
    ) ENGINE = InnoDB`);

    const [filas] = await conexion.query('SELECT nombre FROM migraciones_aplicadas');
    const aplicadas = new Set(filas.map((fila) => fila.nombre));

    const archivos = (await fs.readdir(CARPETA)).filter((nombre) => /^\d{3}_.+\.sql$/.test(nombre)).sort();
    const resumen = { aplicadas: [], omitidas: [] };

    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) {
        resumen.omitidas.push(archivo);
        continue;
      }
      const instrucciones = separarInstrucciones(await fs.readFile(path.join(CARPETA, archivo), 'utf8'));
      let yaExistian = 0;
      for (const instruccion of instrucciones) {
        try {
          await conexion.query(instruccion);
        } catch (error) {
          if (ERRORES_YA_EXISTE.has(error.code)) {
            yaExistian++;
            continue;
          }
          throw new Error(`La migración ${archivo} falló en esta instrucción:\n${instruccion.slice(0, 160)}...\nMotivo: ${error.message}`);
        }
      }
      await conexion.execute('INSERT INTO migraciones_aplicadas (nombre) VALUES (?)', [archivo]);
      resumen.aplicadas.push(archivo);
      mostrar(`  Aplicada: ${archivo} (${instrucciones.length} instrucciones${yaExistian ? `, ${yaExistian} ya existían` : ''})`);
    }

    mostrar(`\nMigraciones aplicadas ahora: ${resumen.aplicadas.length}. Ya estaban aplicadas: ${resumen.omitidas.length}.`);
    return resumen;
  } finally {
    await conexion.end();
  }
}

// Solo se ejecuta si se llama directamente (npm run migrar), no al importarlo en las pruebas.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Migrando la base de datos "${configuracion.db.nombre}"...\n`);
  migrar().catch((error) => {
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(`La base "${configuracion.db.nombre}" no existe. Primero ejecute database/script.sql (vea el README).`);
    } else {
      console.error(`\nNo se pudo migrar: ${error.message}`);
    }
    process.exitCode = 1;
  });
}
