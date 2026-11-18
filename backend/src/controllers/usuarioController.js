// Gestión de cuentas por el personal (administración y dueña).
//
// Protección contra escalada de privilegios: nadie puede crear, activar,
// desactivar ni asignar un rol igual o superior al propio, salvo la dueña.
//   * Administrador: solo cuentas de "ventas" y "proveedor".
//   * Dueña: cualquier cuenta; es la única que cambia roles internos.
//   * Nadie se desactiva a sí mismo; la única dueña activa no puede quitarse el rol.
import { configuracion } from '../config/env.js';
import { enTransaccion } from '../config/db.js';
import { NOMBRES_ROLES, ROLES_INTERNOS } from '../config/permisos.js';
import * as usuarioModel from '../models/usuarioModel.js';
import * as empleadoModel from '../models/empleadoModel.js';
import * as proveedorModel from '../models/proveedorModel.js';
import * as sesionModel from '../models/sesionModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { obtenerCuerpo, validarId, correoObligatorio, valorDeLista, validarBooleano } from '../middleware/validaciones.js';
import { enviarEnlace } from '../servicios/notificaciones.js';
import { generarToken, hashToken } from '../servicios/cripto.js';
import { registrarAuditoria, ipDe } from '../servicios/auditoria.js';

const MINUTOS_INVITACION = 48 * 60;
const ROLES_INVITABLES = ['ventas', 'administrador', 'duena', 'proveedor'];

// Roles que puede gestionar cada rol.
export function rolesGestionables(rolPropio) {
  if (rolPropio === 'duena') return ['cliente', 'proveedor', 'ventas', 'administrador', 'duena'];
  if (rolPropio === 'administrador') return ['ventas', 'proveedor'];
  return [];
}

function exigirPuedeGestionar(rolPropio, rolObjetivo) {
  if (!rolesGestionables(rolPropio).includes(rolObjetivo)) {
    throw new ErrorHttp(403, rolPropio === 'administrador'
      ? 'Un administrador solo puede gestionar cuentas de ventas y de proveedor.'
      : 'No tiene permiso para gestionar esa cuenta.');
  }
}

async function buscarOFallar(id) {
  const usuario = await usuarioModel.obtenerPorId(id);
  if (!usuario) throw new ErrorHttp(404, 'La cuenta no existe.');
  return usuario;
}

// Crea el enlace de invitación y envía el correo dentro de la misma transacción:
// si el correo no sale, no queda nada guardado.
async function invitar(conexion, { usuario, idCreador }) {
  const token = generarToken();
  await usuarioModel.crearEnlace(conexion, {
    idUsuario: usuario.id_usuario,
    proposito: 'invitacion',
    hashToken: hashToken(token),
    minutos: MINUTOS_INVITACION,
    idCreador
  });
  await enviarEnlace({
    para: usuario.correo,
    proposito: 'invitacion',
    enlace: `${configuracion.frontendUrl}/invitacion?token=${token}`,
    minutos: MINUTOS_INVITACION,
    nombreRol: NOMBRES_ROLES[usuario.rol]
  });
}

// GET /api/usuarios
export async function listarUsuarios(req, res, next) {
  try {
    const gestionables = rolesGestionables(req.usuario.rol);
    const usuarios = await usuarioModel.listar();
    res.status(200).json(
      usuarios.map((u) => ({
        ...u,
        nombre_rol: NOMBRES_ROLES[u.rol],
        es_propia: u.id_usuario === req.usuario.id_usuario,
        puede_gestionar: gestionables.includes(u.rol) && u.id_usuario !== req.usuario.id_usuario
      }))
    );
  } catch (error) {
    next(error);
  }
}

// POST /api/usuarios/invitaciones
// { rol, correo, id_empleado (roles internos) | id_proveedor (rol proveedor) }
export async function crearInvitacion(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const rol = valorDeLista(cuerpo.rol, 'El rol', ROLES_INVITABLES);
    exigirPuedeGestionar(req.usuario.rol, rol);
    const correo = correoObligatorio(cuerpo.correo);

    let idEmpleado = null;
    let idProveedor = null;
    if (ROLES_INTERNOS.includes(rol)) {
      idEmpleado = validarId(cuerpo.id_empleado, 'Seleccione el empleado al que pertenece la cuenta.');
      if (!(await empleadoModel.obtenerPorId(idEmpleado))) throw new ErrorHttp(400, 'El empleado seleccionado no existe.');
    } else {
      idProveedor = validarId(cuerpo.id_proveedor, 'Seleccione el proveedor al que pertenece la cuenta.');
      if (!(await proveedorModel.obtenerPorId(idProveedor))) throw new ErrorHttp(400, 'El proveedor seleccionado no existe.');
    }

    const usuario = await enTransaccion(async (conexion) => {
      const idUsuario = await usuarioModel.crearInvitado(conexion, { correo, rol, idEmpleado, idProveedor }); // 409 si se repite
      const nuevo = await usuarioModel.obtenerPorId(idUsuario, conexion);
      await invitar(conexion, { usuario: nuevo, idCreador: req.usuario.id_usuario });
      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        accion: 'usuario_creado',
        detalle: `Cuenta #${idUsuario} (${correo}) con rol ${NOMBRES_ROLES[rol]}; invitación enviada`,
        ip: ipDe(req)
      }, conexion);
      return nuevo;
    });
    res.status(201).json({ ...usuario, nombre_rol: NOMBRES_ROLES[usuario.rol], message: `Cuenta creada. Enviamos la invitación a ${correo} (vence en 48 horas).` });
  } catch (error) {
    if (error.status === 503) error.message = `${error.message} La cuenta no se creó.`;
    next(error);
  }
}

// POST /api/usuarios/:id/invitacion  (reenviar; solo cuentas sin contraseña)
export async function reenviarInvitacion(req, res, next) {
  try {
    const usuario = await buscarOFallar(validarId(req.params.id));
    exigirPuedeGestionar(req.usuario.rol, usuario.rol);
    if (usuario.rol === 'cliente') throw new ErrorHttp(400, 'Las cuentas de cliente no usan invitación.');
    if (usuario.tiene_contrasena) throw new ErrorHttp(409, 'Esta cuenta ya definió su contraseña. Si la olvidó, puede usar "Olvidé mi contraseña".');
    if (!usuario.activo) throw new ErrorHttp(409, 'La cuenta está desactivada. Actívela antes de reenviar la invitación.');
    await enTransaccion(async (conexion) => {
      await invitar(conexion, { usuario, idCreador: req.usuario.id_usuario });
      await registrarAuditoria({ idUsuario: req.usuario.id_usuario, accion: 'invitacion_reenviada', detalle: `Cuenta #${usuario.id_usuario} (${usuario.correo})`, ip: ipDe(req) }, conexion);
    });
    res.status(200).json({ message: `Invitación reenviada a ${usuario.correo}.` });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/usuarios/:id/correo   { correo }
// "Editar" una cuenta creada por el personal: si la invitación se mandó a un
// correo equivocado, se corrige aquí y se anula la invitación anterior.
// Una cuenta que ya definió su contraseña cambia su correo desde su perfil,
// con un código al correo nuevo (así nadie le cambia el correo a otra persona).
export async function cambiarCorreoInvitado(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const correo = correoObligatorio(obtenerCuerpo(req).correo);
    if (id === req.usuario.id_usuario) throw new ErrorHttp(400, 'Su propio correo se cambia en Perfil y seguridad.');
    const usuario = await buscarOFallar(id);
    exigirPuedeGestionar(req.usuario.rol, usuario.rol);
    if (usuario.rol === 'cliente' || usuario.tiene_contrasena) {
      throw new ErrorHttp(409, 'Esta cuenta ya está activa: la persona cambia su correo desde Perfil y seguridad, con un código al correo nuevo.');
    }
    await enTransaccion(async (conexion) => {
      await conexion.execute('UPDATE usuarios SET correo = ?, correo_verificado = 0 WHERE id_usuario = ?', [correo, id]); // 409 si se repite
      await usuarioModel.anularEnlaces(conexion, id);
      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        accion: 'usuario_correo_corregido',
        detalle: `Cuenta #${id}: de ${usuario.correo} a ${correo} (invitación anterior anulada)`,
        ip: ipDe(req)
      }, conexion);
    });
    res.status(200).json({ ...(await usuarioModel.obtenerPorId(id)), message: `Correo corregido. Reenvíe la invitación a ${correo}.` });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/usuarios/:id/estado   { activo: true | false }
export async function cambiarEstado(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const activo = validarBooleano(obtenerCuerpo(req).activo, 'El estado (activo)');
    if (id === req.usuario.id_usuario) throw new ErrorHttp(400, 'No puede desactivar ni reactivar su propia cuenta.');
    const usuario = await buscarOFallar(id);
    exigirPuedeGestionar(req.usuario.rol, usuario.rol);

    await enTransaccion(async (conexion) => {
      await usuarioModel.cambiarEstado(conexion, id, activo);
      // Desactivar una cuenta la saca del sistema de inmediato: se revocan sus sesiones.
      if (!activo) await sesionModel.revocarSesionesDeUsuario(id, { conexion });
      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        accion: activo ? 'usuario_activado' : 'usuario_desactivado',
        detalle: `Cuenta #${id} (${usuario.correo}, ${NOMBRES_ROLES[usuario.rol]})`,
        ip: ipDe(req)
      }, conexion);
    });
    res.status(200).json({ ...(await usuarioModel.obtenerPorId(id)), message: activo ? 'Cuenta activada.' : 'Cuenta desactivada y sesiones cerradas.' });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/usuarios/:id/rol   { rol }   (solo dueña; solo entre roles internos)
export async function cambiarRol(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const rolNuevo = valorDeLista(obtenerCuerpo(req).rol, 'El rol', ROLES_INTERNOS);
    const usuario = await buscarOFallar(id);
    if (!ROLES_INTERNOS.includes(usuario.rol)) {
      throw new ErrorHttp(400, 'Solo se puede cambiar el rol de cuentas internas (ventas, administrador o dueña).');
    }
    if (usuario.rol === rolNuevo) throw new ErrorHttp(400, `La cuenta ya tiene el rol ${NOMBRES_ROLES[rolNuevo]}.`);

    await enTransaccion(async (conexion) => {
      // La tienda nunca puede quedarse sin una dueña activa.
      if (usuario.rol === 'duena' && usuario.activo && (await usuarioModel.contarDuenasActivas(conexion)) <= 1) {
        throw new ErrorHttp(409, 'Esta es la única cuenta de dueña activa: no se le puede quitar el rol.');
      }
      await usuarioModel.cambiarRol(conexion, id, rolNuevo);
      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        accion: 'rol_cambiado',
        detalle: `Cuenta #${id} (${usuario.correo}): de ${NOMBRES_ROLES[usuario.rol]} a ${NOMBRES_ROLES[rolNuevo]}`,
        ip: ipDe(req)
      }, conexion);
    });
    res.status(200).json({ ...(await usuarioModel.obtenerPorId(id)), message: `Rol cambiado a ${NOMBRES_ROLES[rolNuevo]}.` });
  } catch (error) {
    next(error);
  }
}
