// Reportes.
//   * Operativo (administración y dueña): stock bajo, unidades vendidas y
//     devueltas, solicitudes pendientes. Sin costos ni ganancias.
//   * Ejecutivo (solo dueña): ingresos, costos, ganancias y valor del inventario.
//     Las ganancias se calculan SOLO con líneas que tienen costo real; las que no
//     lo tienen se cuentan aparte para que la dueña sepa que el número es parcial.
import pool from '../config/db.js';
import * as configuracionModel from '../models/configuracionModel.js';
import { ErrorHttp } from '../middleware/errores.js';
import { validarFecha } from '../middleware/validaciones.js';

const dinero = (valor) => Math.round(Number(valor || 0) * 100) / 100;

// Rango de fechas: por defecto, los últimos 30 días (incluye hoy).
async function rango(query) {
  const desde = query.desde ? validarFecha(query.desde, 'La fecha "desde"') : null;
  const hasta = query.hasta ? validarFecha(query.hasta, 'La fecha "hasta"') : null;
  const [[hoy]] = await pool.query(
    "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy, DATE_FORMAT(CURDATE() - INTERVAL 29 DAY, '%Y-%m-%d') AS hace30"
  );
  const resultado = { desde: desde ?? hoy.hace30, hasta: hasta ?? hoy.hoy };
  if (resultado.desde > resultado.hasta) throw new ErrorHttp(400, 'La fecha "desde" no puede ser posterior a "hasta".');
  return { ...resultado, inicio: `${resultado.desde} 00:00:00`, fin: `${resultado.hasta} 23:59:59` };
}

// GET /api/reportes/operativo?desde=&hasta=
export async function reporteOperativo(req, res, next) {
  try {
    const r = await rango(req.query);
    const { umbral_pocas_unidades: umbral } = await configuracionModel.obtenerValores();

    const [stockBajo] = await pool.execute(
      `SELECT p.id_producto, p.codigo, p.nombre, p.stock, pr.nombre AS nombre_proveedor, p.id_proveedor
         FROM productos p JOIN proveedores pr ON pr.id_proveedor = p.id_proveedor
        WHERE p.stock <= ? ORDER BY p.stock, p.nombre`,
      [umbral]
    );
    const [[ventas]] = await pool.execute(
      `SELECT COUNT(DISTINCT v.id_venta) AS ventas, COALESCE(SUM(dv.cantidad), 0) AS unidades
         FROM ventas v JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
        WHERE v.fecha BETWEEN ? AND ?`,
      [r.inicio, r.fin]
    );
    const [[devoluciones]] = await pool.execute(
      `SELECT COUNT(DISTINCT d.id_devolucion) AS devoluciones, COALESCE(SUM(dd.cantidad), 0) AS unidades
         FROM devoluciones d JOIN detalle_devoluciones dd ON dd.id_devolucion = d.id_devolucion
        WHERE d.fecha BETWEEN ? AND ?`,
      [r.inicio, r.fin]
    );
    const [masVendidos] = await pool.execute(
      `SELECT p.id_producto, p.codigo, p.nombre, SUM(dv.cantidad) AS unidades
         FROM detalle_ventas dv JOIN ventas v ON v.id_venta = dv.id_venta JOIN productos p ON p.id_producto = dv.id_producto
        WHERE v.fecha BETWEEN ? AND ?
        GROUP BY p.id_producto ORDER BY unidades DESC, p.nombre LIMIT 5`,
      [r.inicio, r.fin]
    );
    const [porVendedor] = await pool.execute(
      `SELECT e.id_empleado, e.nombre, COUNT(DISTINCT v.id_venta) AS ventas, COALESCE(SUM(dv.cantidad), 0) AS unidades
         FROM ventas v JOIN empleados e ON e.id_empleado = v.id_empleado JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
        WHERE v.fecha BETWEEN ? AND ?
        GROUP BY e.id_empleado ORDER BY ventas DESC`,
      [r.inicio, r.fin]
    );
    const [solicitudes] = await pool.query(
      "SELECT estado, COUNT(*) AS total FROM solicitudes_abastecimiento WHERE estado IN ('pendiente', 'aceptada') GROUP BY estado"
    );
    const [[inventario]] = await pool.query('SELECT COUNT(*) AS productos, COALESCE(SUM(stock), 0) AS unidades, SUM(stock = 0) AS agotados FROM productos');

    res.status(200).json({
      desde: r.desde,
      hasta: r.hasta,
      umbral_pocas_unidades: umbral,
      inventario: { productos: inventario.productos, unidades: Number(inventario.unidades), agotados: Number(inventario.agotados || 0) },
      stock_bajo: stockBajo,
      ventas: { cantidad: ventas.ventas, unidades: Number(ventas.unidades) },
      devoluciones: { cantidad: devoluciones.devoluciones, unidades: Number(devoluciones.unidades) },
      mas_vendidos: masVendidos.map((p) => ({ ...p, unidades: Number(p.unidades) })),
      por_vendedor: porVendedor.map((v) => ({ ...v, unidades: Number(v.unidades) })),
      solicitudes: {
        pendientes: solicitudes.find((s) => s.estado === 'pendiente')?.total ?? 0,
        aceptadas: solicitudes.find((s) => s.estado === 'aceptada')?.total ?? 0
      }
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/reportes/ejecutivo?desde=&hasta=   (solo dueña)
export async function reporteEjecutivo(req, res, next) {
  try {
    const r = await rango(req.query);

    // Una fila por línea vendida, con lo devuelto de esa línea (sin importar la fecha de la devolución).
    const LINEAS = `
      SELECT dv.id_detalle_venta, dv.id_producto, dv.cantidad, dv.precio_unitario, dv.costo_unitario, dv.subtotal,
             v.id_venta, v.id_empleado, DATE_FORMAT(v.fecha, '%Y-%m-%d') AS dia,
             COALESCE((SELECT SUM(dd.cantidad) FROM detalle_devoluciones dd WHERE dd.id_detalle_venta = dv.id_detalle_venta), 0) AS devuelta
        FROM detalle_ventas dv JOIN ventas v ON v.id_venta = dv.id_venta
       WHERE v.fecha BETWEEN ? AND ?`;
    const [lineas] = await pool.execute(LINEAS, [r.inicio, r.fin]);

    const resumen = {
      ventas: new Set(lineas.map((l) => l.id_venta)).size,
      unidades_vendidas: 0,
      ingresos_brutos: 0,
      devoluciones: 0,
      ingresos_netos: 0,
      costo_de_lo_vendido: 0,
      ganancia: 0,
      lineas_sin_costo: 0,
      ingresos_sin_costo: 0
    };
    const porDia = new Map();
    const porProducto = new Map();
    const porEmpleado = new Map();

    for (const l of lineas) {
      const netas = l.cantidad - Number(l.devuelta);
      const ingresoNeto = netas * l.precio_unitario;
      resumen.unidades_vendidas += l.cantidad;
      resumen.ingresos_brutos += l.subtotal;
      resumen.devoluciones += Number(l.devuelta) * l.precio_unitario;
      resumen.ingresos_netos += ingresoNeto;
      if (l.costo_unitario === null) {
        resumen.lineas_sin_costo += 1;
        resumen.ingresos_sin_costo += ingresoNeto;
      } else {
        resumen.costo_de_lo_vendido += netas * l.costo_unitario;
        resumen.ganancia += netas * (l.precio_unitario - l.costo_unitario);
      }

      const dia = porDia.get(l.dia) ?? { dia: l.dia, ventas: new Set(), ingresos: 0, ganancia: 0 };
      dia.ventas.add(l.id_venta);
      dia.ingresos += ingresoNeto;
      if (l.costo_unitario !== null) dia.ganancia += netas * (l.precio_unitario - l.costo_unitario);
      porDia.set(l.dia, dia);

      const producto = porProducto.get(l.id_producto) ?? { id_producto: l.id_producto, unidades: 0, ingresos: 0 };
      producto.unidades += netas;
      producto.ingresos += ingresoNeto;
      porProducto.set(l.id_producto, producto);

      const empleado = porEmpleado.get(l.id_empleado) ?? { id_empleado: l.id_empleado, ventas: new Set(), unidades: 0, ingresos: 0 };
      empleado.ventas.add(l.id_venta);
      empleado.unidades += netas;
      empleado.ingresos += ingresoNeto;
      porEmpleado.set(l.id_empleado, empleado);
    }
    for (const clave of Object.keys(resumen)) if (typeof resumen[clave] === 'number' && clave !== 'ventas') resumen[clave] = dinero(resumen[clave]);

    const [productos] = await pool.query('SELECT id_producto, codigo, nombre, precio, costo_unitario, stock FROM productos ORDER BY nombre');
    const [empleados] = await pool.query('SELECT id_empleado, nombre FROM empleados');
    const nombreProducto = new Map(productos.map((p) => [p.id_producto, p]));
    const nombreEmpleado = new Map(empleados.map((e) => [e.id_empleado, e.nombre]));

    const inventario = productos.reduce(
      (acc, p) => {
        acc.unidades += p.stock;
        acc.valor_a_precio_de_venta += p.stock * p.precio;
        if (p.costo_unitario === null) acc.productos_sin_costo.push({ id_producto: p.id_producto, codigo: p.codigo, nombre: p.nombre });
        else acc.valor_a_costo += p.stock * p.costo_unitario;
        return acc;
      },
      { unidades: 0, valor_a_precio_de_venta: 0, valor_a_costo: 0, productos_sin_costo: [] }
    );
    inventario.valor_a_precio_de_venta = dinero(inventario.valor_a_precio_de_venta);
    inventario.valor_a_costo = dinero(inventario.valor_a_costo);

    res.status(200).json({
      desde: r.desde,
      hasta: r.hasta,
      resumen,
      ganancia_parcial: resumen.lineas_sin_costo > 0,
      por_dia: [...porDia.values()]
        .sort((a, b) => a.dia.localeCompare(b.dia))
        .map((d) => ({ dia: d.dia, ventas: d.ventas.size, ingresos: dinero(d.ingresos), ganancia: dinero(d.ganancia) })),
      mas_vendidos: [...porProducto.values()]
        .sort((a, b) => b.unidades - a.unidades || b.ingresos - a.ingresos)
        .slice(0, 5)
        .map((p) => ({ ...p, codigo: nombreProducto.get(p.id_producto)?.codigo, nombre: nombreProducto.get(p.id_producto)?.nombre, ingresos: dinero(p.ingresos) })),
      menor_stock: [...productos].sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre)).slice(0, 5)
        .map((p) => ({ id_producto: p.id_producto, codigo: p.codigo, nombre: p.nombre, stock: p.stock })),
      por_empleado: [...porEmpleado.values()]
        .map((e) => ({ id_empleado: e.id_empleado, nombre: nombreEmpleado.get(e.id_empleado), ventas: e.ventas.size, unidades: e.unidades, ingresos: dinero(e.ingresos) }))
        .sort((a, b) => b.ingresos - a.ingresos),
      inventario
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/auditoria?accion=&desde=&hasta=
export async function listarAuditoria(req, res, next) {
  try {
    const condiciones = [];
    const valores = [];
    if (typeof req.query.accion === 'string' && req.query.accion.trim()) {
      condiciones.push('a.accion = ?');
      valores.push(req.query.accion.trim().slice(0, 60));
    }
    if (req.query.desde) { condiciones.push('a.creado_en >= ?'); valores.push(`${validarFecha(req.query.desde, 'La fecha "desde"')} 00:00:00`); }
    if (req.query.hasta) { condiciones.push('a.creado_en <= ?'); valores.push(`${validarFecha(req.query.hasta, 'La fecha "hasta"')} 23:59:59`); }
    const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const [filas] = await pool.execute(
      `SELECT a.id_auditoria, a.accion, a.detalle, a.ip, a.creado_en, a.id_usuario, u.correo, u.rol
         FROM auditoria a LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
         ${donde}
        ORDER BY a.id_auditoria DESC
        LIMIT 300`,
      valores
    );
    const [acciones] = await pool.query('SELECT DISTINCT accion FROM auditoria ORDER BY accion');
    res.status(200).json({ registros: filas, acciones: acciones.map((a) => a.accion) });
  } catch (error) {
    next(error);
  }
}
