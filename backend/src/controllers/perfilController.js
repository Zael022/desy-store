// Perfil y seguridad de la cuenta propia.
// Todo se hace sobre req.usuario (la cuenta de la sesión): nunca se acepta un
// id de usuario enviado por el navegador.
import pool, { enTransaccion } from '../config/db.js';
import * as usuarioModel from '../models/usuarioModel.js';
import * as sesionModel from '../models/sesionModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import {
  obtenerCuerpo,
  textoObligatorio,
  textoOpcional,
  correoObligatorio,
  contrasenaNueva,
  telefonoInternacional,
  codigoSeisDigitos
} from '../middleware/validaciones.js';
import { generarHashContrasena, verificarContrasena } from '../servicios/contrasenas.js';
import { crearYEnviarCodigo, verificarCodigo } from '../servicios/codigos.js';
import { registrarAuditoria, ipDe } from '../servicios/auditoria.js';
import { enmascararCorreo, enmascararTelefono } from '../servicios/cripto.js';

// Revisa la contraseña actual (para acciones sensibles).
async function exigirContrasenaActual(idUsuario, contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length === 0) {
    throw new ErrorHttp(400, 'Escriba su contraseña actual.');
  }
  const hash = await usuarioModel.obtenerHash(idUsuario);
  if (!hash || !(await verificarContrasena(hash, contrasena.slice(0, 128)))) {
    throw new ErrorHttp(400, 'La contraseña actual no es correcta.');
  }
}

// GET /api/perfil
export async function obtenerPerfil(req, res, next) {
  try {
    const usuario = await sesionModel.datosPublicosDeUsuario(req.usuario.id_usuario);
    const cliente = usuario.rol === 'cliente' ? await usuarioModel.obtenerCliente(req.usuario.id_usuario) : null;
    res.status(200).json({
      ...usuario,
      direccion: cliente?.direccion ?? null,
      canales: [
        { canal: 'correo', destino: enmascararCorreo(usuario.correo), verificado: usuario.correo_verificado },
        { canal: 'sms', destino: usuario.telefono ? enmascararTelefono(usuario.telefono) : null, verificado: usuario.telefono_verificado }
      ]
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/perfil/datos   (solo clientes)  { nombre, direccion }
export async function actualizarDatos(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const datos = {
      nombre: textoObligatorio(cuerpo.nombre, 'El nombre', 100),
      direccion: textoOpcional(cuerpo.direccion, 'La dirección', 255)
    };
    await usuarioModel.actualizarCliente(req.usuario.id_usuario, datos);
    res.status(200).json({ message: 'Datos actualizados.', ...datos });
  } catch (error) {
    next(error);
  }
}

// PUT /api/perfil/contrasena   { actual, nueva }
// Cambiar la contraseña cierra las demás sesiones (la actual sigue abierta).
export async function cambiarContrasena(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const nueva = contrasenaNueva(cuerpo.nueva, 'La contraseña nueva');
    await exigirContrasenaActual(req.usuario.id_usuario, cuerpo.actual);
    if (cuerpo.actual === nueva) throw new ErrorHttp(400, 'La contraseña nueva debe ser diferente de la actual.');
    const hash = await generarHashContrasena(nueva);
    await enTransaccion(async (conexion) => {
      await usuarioModel.guardarContrasena(conexion, req.usuario.id_usuario, hash);
      await sesionModel.revocarSesionesDeUsuario(req.usuario.id_usuario, { excepto: req.usuario.id_sesion, conexion });
      await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: 'contrasena_cambiada', detalle: 'Se cerraron las demás sesiones', ip: ipDe(req) }, conexion);
    });
    res.status(200).json({ message: 'Contraseña cambiada. Se cerraron las sesiones abiertas en otros dispositivos.' });
  } catch (error) {
    next(error);
  }
}

// POST /api/perfil/correo   { correo_nuevo, contrasena }
// El código va al correo NUEVO: así se comprueba que le pertenece.
export async function pedirCambioCorreo(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const correoNuevo = correoObligatorio(cuerpo.correo_nuevo, 'El correo nuevo');
    await exigirContrasenaActual(req.usuario.id_usuario, cuerpo.contrasena);
    if (correoNuevo === req.usuario.correo) throw new ErrorHttp(400, 'Ese ya es su correo actual.');
    if (await usuarioModel.obtenerPorCorreo(correoNuevo)) throw new ErrorHttp(409, 'Ya existe una cuenta con ese correo.');
    const { minutos } = await crearYEnviarCodigo(pool, {
      idUsuario: req.usuario.id_usuario,
      proposito: 'cambio_correo',
      canal: 'correo',
      destino: correoNuevo
    });
    res.status(200).json({ message: `Le enviamos un código a ${enmascararCorreo(correoNuevo)}. Vence en ${minutos} minutos.` });
  } catch (error) {
    next(error);
  }
}

// POST /api/perfil/correo/confirmar   { codigo }
export async function confirmarCambioCorreo(req, res, next) {
  try {
    const codigo = codigoSeisDigitos(obtenerCuerpo(req).codigo);
    const resultado = await enTransaccion(async (conexion) => {
      const verificacion = await verificarCodigo(conexion, { idUsuario: req.usuario.id_usuario, proposito: 'cambio_correo', codigo });
      if (!verificacion.valido) return verificacion;
      const correoNuevo = verificacion.registro.destino;
      await usuarioModel.cambiarCorreo(conexion, req.usuario.id_usuario, correoNuevo); // si otro lo tomó entretanto: 409 por UNIQUE
      await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: 'correo_cambiado', detalle: `De ${req.usuario.correo} a ${correoNuevo}`, ip: ipDe(req) }, conexion);
      return { ...verificacion, correoNuevo };
    });
    if (!resultado.valido) throw new ErrorHttp(resultado.status, resultado.mensaje);
    res.status(200).json({ message: 'Correo actualizado y verificado.', correo: resultado.correoNuevo });
  } catch (error) {
    next(error);
  }
}

// POST /api/perfil/telefono   { telefono }   -> código por SMS al teléfono indicado
export async function pedirVerificacionTelefono(req, res, next) {
  try {
    const telefono = telefonoInternacional(obtenerCuerpo(req).telefono);
    const { minutos } = await crearYEnviarCodigo(pool, {
      idUsuario: req.usuario.id_usuario,
      proposito: 'verificar_telefono',
      canal: 'sms',
      destino: telefono
    });
    res.status(200).json({ message: `Le enviamos un SMS a ${enmascararTelefono(telefono)}. Vence en ${minutos} minutos.` });
  } catch (error) {
    next(error);
  }
}

// POST /api/perfil/telefono/confirmar   { codigo }
export async function confirmarTelefono(req, res, next) {
  try {
    const codigo = codigoSeisDigitos(obtenerCuerpo(req).codigo);
    const resultado = await enTransaccion(async (conexion) => {
      const verificacion = await verificarCodigo(conexion, { idUsuario: req.usuario.id_usuario, proposito: 'verificar_telefono', codigo });
      if (!verificacion.valido) return verificacion;
      await usuarioModel.guardarTelefonoVerificado(conexion, req.usuario.id_usuario, verificacion.registro.destino);
      await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: 'telefono_verificado', ip: ipDe(req) }, conexion);
      return verificacion;
    });
    if (!resultado.valido) throw new ErrorHttp(resultado.status, resultado.mensaje);
    res.status(200).json({ message: 'Teléfono verificado. Ya puede recibir códigos por SMS.' });
  } catch (error) {
    next(error);
  }
}

// GET /api/perfil/sesiones
export async function listarSesiones(req, res, next) {
  try {
    const sesiones = await sesionModel.listarSesionesActivas(req.usuario.id_usuario);
    res.status(200).json(sesiones.map((s) => ({ ...s, actual: s.id_sesion === req.usuario.id_sesion })));
  } catch (error) {
    next(error);
  }
}

// POST /api/perfil/sesiones/cerrar-otras
export async function cerrarOtrasSesiones(req, res, next) {
  try {
    await sesionModel.revocarSesionesDeUsuario(req.usuario.id_usuario, { excepto: req.usuario.id_sesion });
    await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: 'sesiones_cerradas', detalle: 'Cerró las demás sesiones', ip: ipDe(req) });
    res.status(200).json({ message: 'Se cerraron las demás sesiones.' });
  } catch (error) {
    next(error);
  }
}
