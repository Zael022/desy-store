// Controlador de configuración y salud de la API.
import pool, { enTransaccion } from '../config/db.js';
import { STOCK_MINIMO, STOCK_MAXIMO } from '../config/constantes.js';
import * as configuracionModel from '../models/configuracionModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { obtenerCuerpo, enteroEnRango, validarBooleano, textoOpcional } from '../middleware/validaciones.js';
import { registrarAuditoria, ipDe } from '../servicios/auditoria.js';

// GET /api/configuracion -> datos públicos: stock máximo (67) y umbral de "pocas unidades".
export async function obtenerConfiguracion(req, res, next) {
  try {
    const valores = await configuracionModel.obtenerValores();
    res.status(200).json({
      stock_minimo: STOCK_MINIMO,
      stock_maximo: STOCK_MAXIMO,
      umbral_pocas_unidades: valores.umbral_pocas_unidades
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/salud -> sirve para comprobar que la API y MySQL responden.
export async function verificarSalud(req, res, next) {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ message: 'La API y la base de datos están funcionando.' });
  } catch (error) {
    next(error);
  }
}

// GET /api/configuracion/sistema (administración y dueña)
export async function obtenerConfiguracionSistema(req, res, next) {
  try {
    res.status(200).json(await configuracionModel.listarConDetalle());
  } catch (error) {
    next(error);
  }
}

// PUT /api/configuracion/sistema (solo dueña)
// { umbral_pocas_unidades?, proveedor_ve_stock?, mensaje_catalogo?,
//   horas_pedido_pendiente?, dias_pedido_confirmado? } (se cambia solo lo que venga)
export async function actualizarConfiguracionSistema(req, res, next) {
  try {
    const cuerpo = obtenerCuerpo(req);
    const cambios = {};
    if (Object.hasOwn(cuerpo, 'umbral_pocas_unidades')) {
      cambios.umbral_pocas_unidades = enteroEnRango(cuerpo.umbral_pocas_unidades, 'El umbral de pocas unidades', 1, STOCK_MAXIMO);
    }
    if (Object.hasOwn(cuerpo, 'proveedor_ve_stock')) {
      cambios.proveedor_ve_stock = validarBooleano(cuerpo.proveedor_ve_stock, 'Mostrar el stock a los proveedores');
    }
    if (Object.hasOwn(cuerpo, 'mensaje_catalogo')) {
      cambios.mensaje_catalogo = textoOpcional(cuerpo.mensaje_catalogo, 'El mensaje del catálogo', 255) ?? '';
    }
    if (Object.hasOwn(cuerpo, 'horas_pedido_pendiente')) {
      cambios.horas_pedido_pendiente = enteroEnRango(cuerpo.horas_pedido_pendiente, 'Las horas para confirmar un pedido', 1, 720);
    }
    if (Object.hasOwn(cuerpo, 'dias_pedido_confirmado')) {
      cambios.dias_pedido_confirmado = enteroEnRango(cuerpo.dias_pedido_confirmado, 'Los días para recoger un pedido', 1, 60);
    }
    const desconocidas = Object.keys(cuerpo).filter((clave) => !configuracionModel.CLAVES[clave]);
    if (desconocidas.length > 0) throw new ErrorHttp(400, `Opción desconocida: ${desconocidas.join(', ')}.`);
    if (Object.keys(cambios).length === 0) throw new ErrorHttp(400, 'No envió ningún cambio.');

    await enTransaccion(async (conexion) => {
      for (const [clave, valor] of Object.entries(cambios)) {
        await configuracionModel.guardar(conexion, clave, valor, req.usuario.id_usuario);
      }
      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        accion: 'configuracion_cambiada',
        detalle: Object.entries(cambios).map(([c, v]) => `${c} = ${v}`).join('; '),
        ip: ipDe(req)
      }, conexion);
    });
    res.status(200).json(await configuracionModel.listarConDetalle());
  } catch (error) {
    next(error);
  }
}
