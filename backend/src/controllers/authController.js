// Controlador de autenticación: registro, verificación de correo, login en dos
// pasos (contraseña + código MFA), cierre de sesión, recuperación de contraseña
// e invitaciones.
//
// MFA (autenticación de dos factores). Analogía: para entrar a la bodega hace
// falta la llave (la contraseña) Y además un código que le llega al teléfono o
// al correo en ese momento. Si alguien roba la llave, igual no puede entrar.
//
// Flujo del login:
//   1. POST /login con correo y contraseña. Si son correctos NO se crea la sesión:
//      se crea un "desafío" de 5 minutos (cookie desy_mfa) que solo sirve para el MFA.
//   2. POST /mfa/enviar con el canal elegido (correo o SMS verificado).
//   3. POST /mfa/verificar con el código. Si es correcto, recién ahí se crea la sesión.
import { configuracion } from '../config/env.js';
import pool, { enTransaccion } from '../config/db.js';
import { NOMBRES_ROLES } from '../config/permisos.js';
import * as usuarioModel from '../models/usuarioModel.js';
import * as sesionModel from '../models/sesionModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { COOKIES, RUTA_COOKIE_DESAFIO, opcionesCookie } from '../middleware/sesion.js';
import { emitirTokenCsrf } from '../middleware/csrf.js';
import {
  obtenerCuerpo,
  textoObligatorio,
  correoObligatorio,
  contrasenaNueva,
  telefonoInternacional,
  codigoSeisDigitos,
  tokenDeEnlace,
  valorDeLista
} from '../middleware/validaciones.js';
import { generarHashContrasena, verificarContrasena, simularVerificacion } from '../servicios/contrasenas.js';
import { crearYEnviarCodigo, verificarCodigo } from '../servicios/codigos.js';
import { enviarCorreo, enviarEnlace, correoDisponible, ErrorEnvio } from '../servicios/notificaciones.js';
import { generarToken, hashToken, enmascararCorreo, enmascararTelefono } from '../servicios/cripto.js';
import { registrarAuditoria, ipDe } from '../servicios/auditoria.js';

// Mensaje único para correo inexistente O contraseña incorrecta:
// así nadie puede averiguar qué correos tienen cuenta.
const MENSAJE_LOGIN_INCORRECTO = 'Correo o contraseña incorrectos.';
const MENSAJE_BLOQUEO = 'Demasiados intentos fallidos. Por seguridad, espere 15 minutos e intente de nuevo.';
const MENSAJE_RECUPERACION = 'Si el correo está registrado, le enviamos un enlace para restablecer la contraseña. Revise también la carpeta de spam.';
const MINUTOS_RECUPERACION = 15;
const RECUPERACIONES_POR_HORA = 3;

// Página a la que va cada rol después del MFA.
export const DESTINO_POR_ROL = {
  cliente: '/cliente',
  proveedor: '/proveedor',
  ventas: '/pos',
  administrador: '/admin',
  duena: '/duena'
};

// ---------------------------------------------------------------------
// Intentos fallidos de correos que NO existen (en memoria).
// Se cuentan igual que los de cuentas reales para que el bloqueo no delate
// si una cuenta existe.
// ---------------------------------------------------------------------
const fallosDeCorreosDesconocidos = new Map();

function correoDesconocidoBloqueado(correo) {
  const registro = fallosDeCorreosDesconocidos.get(correo);
  return Boolean(registro && registro.bloqueadoHasta > Date.now());
}

function contarFalloDesconocido(correo) {
  const ahora = Date.now();
  const registro = fallosDeCorreosDesconocidos.get(correo) ?? { intentos: 0, bloqueadoHasta: 0 };
  registro.intentos += 1;
  if (registro.intentos >= usuarioModel.INTENTOS_ANTES_DE_BLOQUEAR) {
    registro.intentos = 0;
    registro.bloqueadoHasta = ahora + usuarioModel.MINUTOS_DE_BLOQUEO * 60 * 1000;
  }
  fallosDeCorreosDesconocidos.set(correo, registro);
  const quedoBloqueado = registro.bloqueadoHasta > ahora;
  // Limpieza simple para que el mapa no crezca sin fin.
  if (fallosDeCorreosDesconocidos.size > 5000) {
    for (const [clave, valor] of fallosDeCorreosDesconocidos) {
      if (valor.bloqueadoHasta < ahora) fallosDeCorreosDesconocidos.delete(clave);
    }
  }
  return quedoBloqueado;
}

// Canales verificados donde se puede recibir el código MFA (con el destino enmascarado).
function canalesDe(usuario) {
  const canales = [];
  if (usuario.correo_verificado) canales.push({ canal: 'correo', destino: enmascararCorreo(usuario.correo) });
  if (usuario.telefono_verificado && usuario.telefono) canales.push({ canal: 'sms', destino: enmascararTelefono(usuario.telefono) });
  return canales;
}

function limpiarCookiesDeSesion(res) {
  res.clearCookie(COOKIES.sesion, opcionesCookie());
  res.clearCookie(COOKIES.desafio, opcionesCookie({ ruta: RUTA_COOKIE_DESAFIO }));
}

// ---------------------------------------------------------------------
// GET /api/auth/csrf
// ---------------------------------------------------------------------
export function obtenerCsrf(req, res) {
  res.status(200).json({ csrfToken: emitirTokenCsrf(res) });
}

// ---------------------------------------------------------------------
// POST /api/auth/registro  (solo clientes; el rol que envíe el navegador se ignora)
// ---------------------------------------------------------------------
export async function registrar(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const datos = {
      nombre: textoObligatorio(cuerpo.nombre, 'El nombre', 100),
      correo: correoObligatorio(cuerpo.correo),
      contrasena: contrasenaNueva(cuerpo.contrasena),
      telefono: cuerpo.telefono ? telefonoInternacional(cuerpo.telefono) : null
    };
    // Aunque el cuerpo traiga "rol": "duena", aquí no se lee: toda cuenta pública es de cliente.
    if (!correoDisponible()) {
      throw new ErrorEnvio('El envío de correos no está configurado en el servidor, así que no podemos verificar su correo. Avise a la tienda.');
    }

    const respuesta = {
      message: 'Si los datos son válidos, le enviamos un código de 6 dígitos a su correo para verificar la cuenta.',
      correo: datos.correo
    };

    const existente = await usuarioModel.obtenerPorCorreo(datos.correo);
    if (existente) {
      // No revelamos que el correo ya existe: respondemos igual y avisamos al dueño de ese correo.
      await simularVerificacion();
      await enviarCorreo({
        para: datos.correo,
        asunto: 'Desy · Alguien intentó registrarse con su correo',
        texto: 'Alguien intentó crear una cuenta en Desy con este correo, pero usted ya tiene una. Si fue usted, inicie sesión o use "Olvidé mi contraseña". Si no fue usted, puede ignorar este mensaje.'
      });
      await registrarAuditoria({ idUsuario: existente.id_usuario, accion: 'registro_correo_existente', ip: ipDe(req) });
      return res.status(201).json(respuesta);
    }

    const hash = await generarHashContrasena(datos.contrasena);
    // La cuenta y el código van en la misma transacción: si el correo no se puede
    // enviar, no queda una cuenta a medias.
    await enTransaccion(async (conexion) => {
      const idUsuario = await usuarioModel.crearCliente(conexion, { ...datos, hash });
      await crearYEnviarCodigo(conexion, { idUsuario, proposito: 'verificar_correo', canal: 'correo', destino: datos.correo });
      await registrarAuditoria({ idUsuario, accion: 'registro_cliente', detalle: `Cuenta de cliente creada (${datos.correo})`, ip: ipDe(req) }, conexion);
    });
    res.status(201).json(respuesta);
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/verificar-correo   { correo, codigo }
// ---------------------------------------------------------------------
export async function verificarCorreo(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const correo = correoObligatorio(cuerpo.correo);
    const codigo = codigoSeisDigitos(cuerpo.codigo);

    const usuario = await usuarioModel.obtenerPorCorreo(correo);
    if (!usuario || usuario.correo_verificado) {
      throw new ErrorHttp(400, 'No hay un código vigente para ese correo. Pida un código nuevo.');
    }

    // Los intentos fallidos deben quedar guardados, por eso la transacción
    // termina (COMMIT) y DESPUÉS se responde con el error.
    const resultado = await enTransaccion(async (conexion) => {
      const verificacion = await verificarCodigo(conexion, { idUsuario: usuario.id_usuario, proposito: 'verificar_correo', codigo });
      if (verificacion.valido) {
        await usuarioModel.marcarCorreoVerificado(conexion, usuario.id_usuario);
        await registrarAuditoria({ idUsuario: usuario.id_usuario, accion: 'correo_verificado', ip: ipDe(req) }, conexion);
      }
      return verificacion;
    });
    if (!resultado.valido) throw new ErrorHttp(resultado.status, resultado.mensaje);

    res.status(200).json({ message: 'Correo verificado. Ya puede iniciar sesión.' });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/verificar-correo/reenviar   { correo }
// ---------------------------------------------------------------------
export async function reenviarVerificacion(req, res, next) {
  try {
    const correo = correoObligatorio(obtenerCuerpo(req).correo);
    const usuario = await usuarioModel.obtenerPorCorreo(correo);
    if (usuario && usuario.activo && !usuario.correo_verificado && usuario.tiene_contrasena) {
      await crearYEnviarCodigo(pool, { idUsuario: usuario.id_usuario, proposito: 'verificar_correo', canal: 'correo', destino: correo });
    }
    res.status(200).json({ message: 'Si la cuenta existe y falta verificarla, le enviamos un código nuevo.' });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/login   { correo, contrasena }   (paso 1 de 3)
// ---------------------------------------------------------------------
export async function iniciarSesion(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    if (typeof cuerpo.correo !== 'string' || typeof cuerpo.contrasena !== 'string' || !cuerpo.correo.trim() || !cuerpo.contrasena) {
      throw new ErrorHttp(400, 'Escriba su correo y su contraseña.');
    }
    const correo = cuerpo.correo.trim().toLowerCase().slice(0, 100);
    const contrasena = cuerpo.contrasena.slice(0, 128);
    const ip = ipDe(req);

    const usuario = await usuarioModel.buscarParaLogin(correo);

    // Cuenta inexistente o sin contraseña todavía (invitación pendiente):
    // se hace el mismo trabajo y se responde lo mismo que con una contraseña incorrecta.
    if (!usuario || !usuario.hash_contrasena) {
      await simularVerificacion();
      if (correoDesconocidoBloqueado(correo)) throw new ErrorHttp(429, MENSAJE_BLOQUEO);
      const quedoBloqueado = contarFalloDesconocido(correo);
      await registrarAuditoria({ idUsuario: usuario?.id_usuario ?? null, accion: 'login_fallido', detalle: `Correo: ${correo}`, ip });
      // Igual que con una cuenta real: al quinto fallo se responde 429.
      throw new ErrorHttp(quedoBloqueado ? 429 : 401, quedoBloqueado ? MENSAJE_BLOQUEO : MENSAJE_LOGIN_INCORRECTO);
    }

    if (usuario.bloqueado) {
      await simularVerificacion();
      await registrarAuditoria({ idUsuario: usuario.id_usuario, accion: 'login_bloqueado', ip });
      throw new ErrorHttp(429, MENSAJE_BLOQUEO);
    }

    const correcta = await verificarContrasena(usuario.hash_contrasena, contrasena);
    if (!correcta) {
      const quedoBloqueada = await usuarioModel.registrarIntentoFallido(usuario.id_usuario);
      await registrarAuditoria({ idUsuario: usuario.id_usuario, accion: 'login_fallido', detalle: quedoBloqueada ? 'Cuenta bloqueada 15 minutos' : null, ip });
      throw new ErrorHttp(quedoBloqueada ? 429 : 401, quedoBloqueada ? MENSAJE_BLOQUEO : MENSAJE_LOGIN_INCORRECTO);
    }

    await usuarioModel.reiniciarIntentos(usuario.id_usuario);

    // Estos avisos solo se dan si la contraseña fue correcta (no delatan nada a un extraño).
    if (!usuario.activo) {
      await registrarAuditoria({ idUsuario: usuario.id_usuario, accion: 'login_cuenta_inactiva', ip });
      throw new ErrorHttp(403, 'Esta cuenta está desactivada. Comuníquese con la tienda.');
    }
    if (!usuario.correo_verificado) {
      return res.status(200).json({
        estado: 'verificar_correo',
        correo: usuario.correo,
        message: 'Antes de entrar debe verificar su correo con el código que le enviamos.'
      });
    }

    // Contraseña correcta: se crea el DESAFÍO (no la sesión).
    const tokenDesafio = await sesionModel.crearDesafio({ idUsuario: usuario.id_usuario, ip });
    res.cookie(COOKIES.desafio, tokenDesafio, opcionesCookie({ maxAgeMs: sesionModel.MINUTOS_DESAFIO * 60 * 1000, ruta: RUTA_COOKIE_DESAFIO }));
    await registrarAuditoria({ idUsuario: usuario.id_usuario, accion: 'login_contrasena_correcta', detalle: 'Falta el código MFA', ip });

    res.status(200).json({
      estado: 'mfa',
      canales: canalesDe(usuario),
      minutos: sesionModel.MINUTOS_DESAFIO,
      message: 'Elija dónde quiere recibir su código de verificación.'
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// GET /api/auth/mfa/canales   (requiere el desafío)
// ---------------------------------------------------------------------
export function obtenerCanales(req, res) {
  res.status(200).json({ canales: canalesDe(req.desafio) });
}

// ---------------------------------------------------------------------
// POST /api/auth/mfa/enviar   { canal: "correo" | "sms" }   (paso 2 de 3)
// ---------------------------------------------------------------------
export async function enviarCodigoMfa(req, res, next) {
  try {
    const canal = valorDeLista(obtenerCuerpo(req).canal, 'El canal', ['correo', 'sms']);
    const desafio = req.desafio;
    const disponible = canalesDe(desafio).find((c) => c.canal === canal);
    if (!disponible) {
      throw new ErrorHttp(400, canal === 'sms' ? 'Su teléfono no está verificado. Use el correo.' : 'Su correo no está verificado.');
    }
    const destino = canal === 'sms' ? desafio.telefono : desafio.correo;
    const { minutos, esperaReenvio } = await crearYEnviarCodigo(pool, {
      idUsuario: desafio.id_usuario,
      idDesafio: desafio.id_desafio,
      proposito: 'mfa',
      canal,
      destino
    });
    await registrarAuditoria({ idUsuario: desafio.id_usuario, accion: 'mfa_codigo_enviado', detalle: `Canal: ${canal}`, ip: ipDe(req) });
    res.status(200).json({
      message: `Le enviamos un código a ${disponible.destino}.`,
      canal,
      destino: disponible.destino,
      minutos,
      espera_reenvio: esperaReenvio
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/mfa/verificar   { codigo }   (paso 3 de 3)
// ---------------------------------------------------------------------
export async function verificarCodigoMfa(req, res, next) {
  try {
    const codigo = codigoSeisDigitos(obtenerCuerpo(req).codigo);
    const desafio = req.desafio;
    const ip = ipDe(req);

    const resultado = await enTransaccion(async (conexion) => {
      const verificacion = await verificarCodigo(conexion, {
        idUsuario: desafio.id_usuario,
        idDesafio: desafio.id_desafio,
        proposito: 'mfa',
        codigo
      });
      if (!verificacion.valido) {
        await registrarAuditoria({ idUsuario: desafio.id_usuario, accion: 'mfa_fallido', detalle: verificacion.mensaje, ip }, conexion);
        return verificacion;
      }
      await sesionModel.marcarDesafioUsado(conexion, desafio.id_desafio);
      const token = await sesionModel.crearSesion(conexion, { idUsuario: desafio.id_usuario, ip, agente: req.get('user-agent') });
      await usuarioModel.registrarAcceso(conexion, desafio.id_usuario);
      await registrarAuditoria({ idUsuario: desafio.id_usuario, accion: 'login_exitoso', detalle: 'Contraseña y código MFA correctos', ip }, conexion);
      return { ...verificacion, token };
    });
    if (!resultado.valido) throw new ErrorHttp(resultado.status, resultado.mensaje);

    // Ya hay sesión real: cookie de sesión, se borra la del desafío y se renueva el token CSRF.
    res.cookie(COOKIES.sesion, resultado.token, opcionesCookie({ maxAgeMs: configuracion.seguridad.sesionAbsolutaHoras * 60 * 60 * 1000 }));
    res.clearCookie(COOKIES.desafio, opcionesCookie({ ruta: RUTA_COOKIE_DESAFIO }));
    const csrfToken = emitirTokenCsrf(res);
    const usuario = await sesionModel.datosPublicosDeUsuario(desafio.id_usuario);
    res.status(200).json({ message: 'Sesión iniciada.', usuario, destino: DESTINO_POR_ROL[usuario.rol], csrfToken });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------
export async function cerrarSesion(req, res, next) {
  try {
    if (req.usuario) {
      await sesionModel.revocarSesion(req.usuario.id_sesion); // se revoca en el servidor, no solo se borra la cookie
      await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: 'logout', ip: ipDe(req) });
    }
    limpiarCookiesDeSesion(res);
    res.status(200).json({ message: 'Sesión cerrada.', csrfToken: emitirTokenCsrf(res) });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// GET /api/auth/sesion
// ---------------------------------------------------------------------
export async function obtenerSesion(req, res, next) {
  try {
    const usuario = await sesionModel.datosPublicosDeUsuario(req.usuario.id_usuario);
    res.status(200).json({ usuario, destino: DESTINO_POR_ROL[usuario.rol] });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/recuperar   { correo }
// La respuesta es la MISMA exista o no el correo.
// ---------------------------------------------------------------------
export async function pedirRecuperacion(req, res, next) {
  try {
    const correo = correoObligatorio(obtenerCuerpo(req).correo);
    // Se revisa antes de buscar la cuenta, así el error es igual para todos los correos.
    if (!correoDisponible()) {
      throw new ErrorEnvio('El envío de correos no está configurado en el servidor. Avise a la tienda.');
    }
    const usuario = await usuarioModel.obtenerPorCorreo(correo);
    // Clientes: también los del seed, que tienen el correo verificado pero aún no tienen contraseña.
    // Cuentas internas o de proveedor sin contraseña: deben usar su invitación.
    const puedeRecuperar = usuario && usuario.activo && usuario.correo_verificado && (usuario.tiene_contrasena || usuario.rol === 'cliente');

    if (puedeRecuperar && (await usuarioModel.contarEnlacesRecientes(usuario.id_usuario, 'recuperar')) < RECUPERACIONES_POR_HORA) {
      const token = generarToken();
      await enTransaccion(async (conexion) => {
        await usuarioModel.crearEnlace(conexion, { idUsuario: usuario.id_usuario, proposito: 'recuperar', hashToken: hashToken(token), minutos: MINUTOS_RECUPERACION });
        await enviarEnlace({
          para: usuario.correo,
          proposito: 'recuperar',
          enlace: `${configuracion.frontendUrl}/restablecer?token=${token}`,
          minutos: MINUTOS_RECUPERACION
        });
        await registrarAuditoria({ idUsuario: usuario.id_usuario, accion: 'recuperacion_solicitada', ip: ipDe(req) }, conexion);
      });
    } else {
      await simularVerificacion(); // mismo tiempo de respuesta aproximado
    }
    res.status(200).json({ message: MENSAJE_RECUPERACION });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/restablecer   { token, contrasena }
// ---------------------------------------------------------------------
export async function restablecerContrasena(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const token = tokenDeEnlace(cuerpo.token);
    const contrasena = contrasenaNueva(cuerpo.contrasena, 'La contraseña nueva');
    const hash = await generarHashContrasena(contrasena);

    await enTransaccion(async (conexion) => {
      const enlace = await usuarioModel.buscarEnlace(hashToken(token), 'recuperar', conexion);
      if (!enlace || !enlace.activo) throw new ErrorHttp(400, 'El enlace no es válido o ya expiró. Pida uno nuevo.');
      await usuarioModel.guardarContrasena(conexion, enlace.id_usuario, hash);
      await usuarioModel.anularEnlaces(conexion, enlace.id_usuario);
      // Cambiar la contraseña cierra TODAS las sesiones abiertas.
      await sesionModel.revocarSesionesDeUsuario(enlace.id_usuario, { conexion });
      await registrarAuditoria({ idUsuario: enlace.id_usuario, accion: 'contrasena_restablecida', detalle: 'Con enlace de recuperación; se cerraron todas las sesiones', ip: ipDe(req) }, conexion);
    });
    limpiarCookiesDeSesion(res);
    res.status(200).json({ message: 'Contraseña actualizada. Inicie sesión con la nueva contraseña.' });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/invitacion/validar   { token }
// ---------------------------------------------------------------------
export async function validarInvitacion(req, res, next) {
  try {
    const token = tokenDeEnlace(obtenerCuerpo(req).token);
    const enlace = await usuarioModel.buscarEnlace(hashToken(token), 'invitacion');
    if (!enlace || !enlace.activo) throw new ErrorHttp(400, 'La invitación no es válida o ya expiró. Pida a la tienda que la reenvíe.');
    res.status(200).json({ correo: enlace.correo, nombre: enlace.nombre, rol: enlace.rol, nombre_rol: NOMBRES_ROLES[enlace.rol] });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/invitacion/aceptar   { token, contrasena }
// El enlace llegó al correo: abrirlo demuestra que el correo es de la persona,
// por eso aquí el correo queda verificado.
// ---------------------------------------------------------------------
export async function aceptarInvitacion(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const token = tokenDeEnlace(cuerpo.token);
    const hash = await generarHashContrasena(contrasenaNueva(cuerpo.contrasena));

    await enTransaccion(async (conexion) => {
      const enlace = await usuarioModel.buscarEnlace(hashToken(token), 'invitacion', conexion);
      if (!enlace || !enlace.activo) throw new ErrorHttp(400, 'La invitación no es válida o ya expiró. Pida a la tienda que la reenvíe.');
      await usuarioModel.guardarContrasena(conexion, enlace.id_usuario, hash);
      await usuarioModel.marcarCorreoVerificado(conexion, enlace.id_usuario);
      await usuarioModel.anularEnlaces(conexion, enlace.id_usuario);
      await sesionModel.revocarSesionesDeUsuario(enlace.id_usuario, { conexion });
      await registrarAuditoria({ idUsuario: enlace.id_usuario, accion: 'invitacion_aceptada', ip: ipDe(req) }, conexion);
    });
    res.status(200).json({ message: 'Cuenta activada. Ya puede iniciar sesión.' });
  } catch (error) {
    next(error);
  }
}
