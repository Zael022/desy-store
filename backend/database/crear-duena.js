// =====================================================================
// Crea la PRIMERA cuenta de dueña.   Uso: npm run crear-duena
//
// * Pide los datos en la terminal (la contraseña no se ve al escribirla).
//   Si en el .env existen DUENA_NOMBRE, DUENA_CORREO y DUENA_CONTRASENA, los
//   usa en vez de preguntar (bórrelos del .env después).
// * Envía un código al correo para comprobar que es suyo (en modo consola el
//   código aparece en esta misma terminal) y pide escribirlo.
// * Guarda solo el HASH de la contraseña y nunca la imprime.
// * Si ya existe una cuenta de dueña, no hace nada.
// =====================================================================
import readline from 'node:readline';
import pool from '../src/config/db.js';
import { revisarConfiguracion } from '../src/config/env.js';
import { generarHashContrasena, algoritmoEnUso } from '../src/servicios/contrasenas.js';
import { crearYEnviarCodigo, verificarCodigo, REGLAS_CODIGOS } from '../src/servicios/codigos.js';
import { correoDisponible } from '../src/servicios/notificaciones.js';
import { registrarAuditoria } from '../src/servicios/auditoria.js';

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_TELEFONO = /^\+[1-9]\d{7,14}$/;

// ---------- Lectura de la terminal (funciona escribiendo o con datos "pegados") ----------
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
const lineas = rl[Symbol.asyncIterator]();
let ocultar = false;
const escribirOriginal = rl._writeToOutput?.bind(rl);
if (escribirOriginal) {
  // Mientras se escribe la contraseña no se muestra nada en pantalla.
  rl._writeToOutput = (texto) => {
    if (!ocultar || texto.includes('\n')) escribirOriginal(ocultar ? '\n' : texto);
  };
}

async function preguntar(texto, { oculta = false } = {}) {
  process.stdout.write(texto);
  ocultar = oculta;
  const { value, done } = await lineas.next();
  ocultar = false;
  if (done) throw new Error('Se cerró la entrada antes de terminar.');
  return value.trim();
}

async function preguntarHastaValido(texto, validar, opciones) {
  for (;;) {
    const respuesta = await preguntar(texto, opciones);
    const error = validar(respuesta);
    if (!error) return respuesta;
    console.log(`  ${error}`);
  }
}

// ---------- Programa ----------
async function principal() {
  const problemas = revisarConfiguracion();
  if (problemas.length > 0) {
    problemas.forEach((p) => console.error(`- ${p}`));
    throw new Error('Corrija el .env antes de crear la dueña.');
  }

  const [duenas] = await pool.query("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'duena'");
  if (duenas[0].total > 0) {
    console.log('Ya existe una cuenta de dueña. No se hizo ningún cambio.');
    console.log('Para crear otra, inicie sesión como dueña y use la sección Usuarios.');
    return;
  }
  if (!correoDisponible()) {
    throw new Error('El correo no está configurado (SMTP_* en el .env) y el modo consola está apagado: no se puede verificar el correo de la dueña.');
  }

  console.log('Creación de la cuenta de dueña de Desy\n');
  const desdeEnv = process.env.DUENA_CORREO && process.env.DUENA_CONTRASENA && process.env.DUENA_NOMBRE;
  let nombre;
  let correo;
  let contrasena;
  let telefono = null;
  if (desdeEnv) {
    console.log('Usando DUENA_NOMBRE, DUENA_CORREO y DUENA_CONTRASENA del .env (bórrelos del .env al terminar).');
    nombre = process.env.DUENA_NOMBRE.trim();
    correo = process.env.DUENA_CORREO.trim().toLowerCase();
    contrasena = process.env.DUENA_CONTRASENA;
    if (!nombre || nombre.length > 100) throw new Error('DUENA_NOMBRE no es válido.');
    if (!PATRON_CORREO.test(correo) || correo.length > 100) throw new Error('DUENA_CORREO no tiene un formato válido.');
    if (contrasena.length < 8 || contrasena.length > 128) throw new Error('DUENA_CONTRASENA debe tener entre 8 y 128 caracteres.');
  } else {
    nombre = await preguntarHastaValido('Nombre completo: ', (v) => (v && v.length <= 100 ? null : 'Escriba un nombre (máximo 100 caracteres).'));
    correo = (await preguntarHastaValido('Correo: ', (v) => (PATRON_CORREO.test(v) && v.length <= 100 ? null : 'Correo no válido (ejemplo: nombre@correo.com).'))).toLowerCase();
    const tel = await preguntarHastaValido('Teléfono para SMS en formato +50688887777 (Enter para omitir): ', (v) =>
      !v || PATRON_TELEFONO.test(v.replace(/[\s-]/g, '')) ? null : 'Use el formato internacional, por ejemplo +50688887777.'
    );
    telefono = tel ? tel.replace(/[\s-]/g, '') : null;
    for (;;) {
      contrasena = await preguntar('Contraseña (mínimo 8 caracteres, no se mostrará): ', { oculta: true });
      if (contrasena.length < 8 || contrasena.length > 128) {
        console.log('  La contraseña debe tener entre 8 y 128 caracteres.');
        continue;
      }
      const repetida = await preguntar('Repita la contraseña: ', { oculta: true });
      if (repetida === contrasena) break;
      console.log('  Las contraseñas no coinciden. Intente de nuevo.');
    }
  }

  const [existente] = await pool.execute('SELECT id_usuario FROM usuarios WHERE correo = ?', [correo]);
  if (existente.length > 0) throw new Error('Ya existe una cuenta con ese correo. Use otro correo.');

  // ¿A qué empleado pertenece la cuenta? (toda cuenta interna está vinculada a un empleado)
  const [libres] = await pool.query(
    `SELECT e.id_empleado, e.nombre, e.puesto, e.correo FROM empleados e
      WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id_empleado = e.id_empleado) ORDER BY e.id_empleado`
  );
  let idEmpleado = libres.find((e) => e.correo.toLowerCase() === correo)?.id_empleado ?? null;
  if (!idEmpleado && libres.length > 0 && !desdeEnv) {
    console.log('\nEmpleados sin cuenta:');
    libres.forEach((e) => console.log(`  ${e.id_empleado}. ${e.nombre} (${e.puesto})`));
    const eleccion = await preguntarHastaValido('Número del empleado que es usted (Enter para registrarla como empleada nueva): ', (v) =>
      !v || libres.some((e) => String(e.id_empleado) === v) ? null : 'Escriba uno de los números de la lista o presione Enter.'
    );
    idEmpleado = eleccion ? Number(eleccion) : null;
  }

  const hash = await generarHashContrasena(contrasena);
  contrasena = null;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    if (!idEmpleado) {
      const [nuevo] = await conexion.execute(
        "INSERT INTO empleados (nombre, puesto, telefono, correo) VALUES (?, 'Dueña', ?, ?)",
        [nombre, telefono, correo]
      );
      idEmpleado = nuevo.insertId;
    }
    const [usuario] = await conexion.execute(
      "INSERT INTO usuarios (correo, hash_contrasena, rol, telefono, id_empleado) VALUES (?, ?, 'duena', ?, ?)",
      [correo, hash, telefono, idEmpleado]
    );
    const idUsuario = usuario.insertId;

    await crearYEnviarCodigo(conexion, { idUsuario, proposito: 'verificar_correo', canal: 'correo', destino: correo });
    console.log(`\nLe enviamos un código de 6 dígitos a ${correo} (vence en 10 minutos).`);
    let verificado = false;
    for (let intento = 1; intento <= REGLAS_CODIGOS.intentosMaximos && !verificado; intento++) {
      const codigo = await preguntar('Código: ');
      if (!/^\d{6}$/.test(codigo)) {
        console.log('  El código debe tener 6 dígitos.');
        continue;
      }
      const resultado = await verificarCodigo(conexion, { idUsuario, proposito: 'verificar_correo', codigo });
      if (resultado.valido) verificado = true;
      else {
        console.log(`  ${resultado.mensaje}`);
        if (resultado.status === 429 || resultado.mensaje.includes('venció')) break;
      }
    }
    if (!verificado) throw new Error('No se verificó el correo. No se creó la cuenta; ejecute el comando de nuevo.');

    await conexion.execute('UPDATE usuarios SET correo_verificado = 1 WHERE id_usuario = ?', [idUsuario]);
    await registrarAuditoria({ idUsuario, accion: 'duena_creada', detalle: 'Primera cuenta de dueña creada con npm run crear-duena' }, conexion);
    await conexion.commit();
    console.log(`\nCuenta de dueña creada para ${correo} (contraseña guardada con ${algoritmoEnUso}).`);
    console.log('Ya puede iniciar sesión en el frontend. El segundo factor (código) se pedirá en cada inicio de sesión.');
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

principal()
  .catch((error) => {
    console.error(`\nNo se creó la cuenta: ${error.message}`);
    if (error.code === 'ER_NO_SUCH_TABLE') console.error('Ejecute primero "npm run migrar".');
    if (error.code === 'ER_DUP_ENTRY') console.error('Ese correo ya lo usa otro empleado o cuenta. Use otro correo o elija ese empleado de la lista.');
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await pool.end();
  });
