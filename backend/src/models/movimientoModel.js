// Modelo de movimientos: entradas y salidas de mercadería.
// Aquí está la LÓGICA DEL STOCK, y es la ÚNICA forma de cambiar el stock:
// el CRUD de movimientos, las ventas, las devoluciones y el abastecimiento
// usan todos la función registrarMovimiento() de este archivo.
//
// Cada operación cambia DOS tablas (movimientos y productos), así que se hace
// dentro de una TRANSACCIÓN: o se guardan los dos cambios, o no se guarda
// ninguno. Es como una transferencia bancaria: el dinero no puede salir de
// una cuenta sin llegar a la otra.
import pool, { enTransaccion } from '../config/db.js';
import { STOCK_MINIMO, STOCK_MAXIMO } from '../config/constantes.js';
import { ErrorHttp } from '../middleware/errores.js';
import { unidadesApartadas } from './apartados.js';

const SELECT_MOVIMIENTOS = `
  SELECT mo.id_movimiento, mo.id_producto, p.codigo AS codigo_producto, p.nombre AS nombre_producto,
         p.stock AS stock_actual, mo.id_empleado, e.nombre AS nombre_empleado,
         mo.tipo, mo.cantidad, mo.fecha, mo.motivo,
         mo.id_venta, mo.id_devolucion, mo.id_solicitud
    FROM movimientos mo
    JOIN productos p ON p.id_producto = mo.id_producto
    JOIN empleados e ON e.id_empleado = mo.id_empleado`;

export async function listar() {
  const [filas] = await pool.query(`${SELECT_MOVIMIENTOS} ORDER BY mo.fecha DESC, mo.id_movimiento DESC`);
  return filas;
}

export async function obtenerPorId(id) {
  const [filas] = await pool.execute(`${SELECT_MOVIMIENTOS} WHERE mo.id_movimiento = ?`, [id]);
  return filas[0] || null;
}

// ---------------------------------------------------------------------
// Ayudantes de la lógica del stock
// ---------------------------------------------------------------------

// Una entrada suma (+cantidad); una salida resta (-cantidad).
function calcularEfecto(tipo, cantidad) {
  return tipo === 'entrada' ? cantidad : -cantidad;
}

// Lanza un error 409 si el stock queda fuera del rango permitido.
function verificarRango(nuevoStock, mensajeExceso, mensajeNegativo) {
  if (nuevoStock > STOCK_MAXIMO) throw new ErrorHttp(409, mensajeExceso);
  if (nuevoStock < STOCK_MINIMO) throw new ErrorHttp(409, mensajeNegativo);
}

// Lee un producto y BLOQUEA su fila (FOR UPDATE) hasta que termine la transacción,
// para que dos personas no cambien el mismo stock al mismo tiempo.
export async function bloquearProducto(conexion, idProducto) {
  const [filas] = await conexion.execute(
    'SELECT id_producto, codigo, nombre, stock, precio, costo_unitario FROM productos WHERE id_producto = ? FOR UPDATE',
    [idProducto]
  );
  if (filas.length === 0) throw new ErrorHttp(400, 'El producto seleccionado no existe.');
  return filas[0];
}

// Guarda el stock nuevo. Si BAJA, revisa que no se lleve unidades apartadas en pedidos
// de clientes (pendientes o confirmados): esas ya tienen dueño.
async function guardarStock(conexion, producto, nuevoStock) {
  if (nuevoStock < producto.stock) {
    const apartado = await unidadesApartadas(conexion, producto.id_producto);
    if (nuevoStock < apartado) {
      const libres = Math.max(producto.stock - apartado, 0);
      throw new ErrorHttp(
        409,
        `"${producto.nombre}" tiene ${apartado} unidad(es) apartadas en pedidos de clientes. ` +
          (libres === 0 ? 'No quedan unidades libres para sacar.' : `Solo se pueden sacar ${libres}.`)
      );
    }
  }
  await conexion.execute('UPDATE productos SET stock = ? WHERE id_producto = ?', [nuevoStock, producto.id_producto]);
}

// Un movimiento creado por una venta, devolución o solicitud no se edita ni se borra a mano.
function verificarQueNoEsAutomatico(movimiento) {
  if (movimiento.id_venta) {
    throw new ErrorHttp(409, `Este movimiento pertenece a la venta #${movimiento.id_venta}. Las ventas no se editan: corrija con una devolución.`);
  }
  if (movimiento.id_devolucion) {
    throw new ErrorHttp(409, `Este movimiento pertenece a la devolución #${movimiento.id_devolucion} y no se puede editar ni eliminar.`);
  }
  if (movimiento.id_solicitud) {
    throw new ErrorHttp(409, `Este movimiento pertenece a la solicitud de abastecimiento #${movimiento.id_solicitud} y no se puede editar ni eliminar.`);
  }
}

// ---------------------------------------------------------------------
// registrarMovimiento: LA función que cambia el stock.
// Debe llamarse con una conexión que ya tiene una transacción abierta.
//   datos: { id_producto, id_empleado, tipo, cantidad, fecha, motivo,
//            id_venta?, id_devolucion?, id_solicitud? }
//   mensajes (opcional): textos propios para el exceso o el faltante.
// ---------------------------------------------------------------------
export async function registrarMovimiento(conexion, datos, mensajes = {}) {
  const producto = await bloquearProducto(conexion, datos.id_producto);
  const nuevoStock = producto.stock + calcularEfecto(datos.tipo, datos.cantidad);

  verificarRango(
    nuevoStock,
    mensajes.exceso?.(producto, nuevoStock) ??
      `La entrada supera el stock máximo de ${STOCK_MAXIMO} unidades. "${producto.nombre}" tiene ${producto.stock}; como máximo puede ingresar ${STOCK_MAXIMO - producto.stock}.`,
    mensajes.faltante?.(producto, nuevoStock) ??
      `La salida deja el stock en negativo. "${producto.nombre}" solo tiene ${producto.stock} unidad(es) disponibles.`
  );

  const [resultado] = await conexion.execute(
    `INSERT INTO movimientos (id_producto, id_empleado, tipo, cantidad, fecha, motivo, id_venta, id_devolucion, id_solicitud)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.id_producto,
      datos.id_empleado,
      datos.tipo,
      datos.cantidad,
      datos.fecha,
      datos.motivo ?? null,
      datos.id_venta ?? null,
      datos.id_devolucion ?? null,
      datos.id_solicitud ?? null
    ]
  );
  await guardarStock(conexion, producto, nuevoStock);
  return { idMovimiento: resultado.insertId, stockAnterior: producto.stock, stockNuevo: nuevoStock, producto };
}

// ---------------------------------------------------------------------
// Crear (CRUD de movimientos): abre la transacción y usa registrarMovimiento.
// ---------------------------------------------------------------------
export async function crear(datos) {
  const resultado = await enTransaccion((conexion) => registrarMovimiento(conexion, datos));
  return resultado.idMovimiento;
}

// ---------------------------------------------------------------------
// Editar: primero revierte el efecto anterior y luego aplica el nuevo.
// Funciona aunque se cambie el producto del movimiento.
// ---------------------------------------------------------------------
export async function actualizar(id, datos) {
  return enTransaccion(async (conexion) => {
    const [filas] = await conexion.execute('SELECT * FROM movimientos WHERE id_movimiento = ? FOR UPDATE', [id]);
    if (filas.length === 0) throw new ErrorHttp(404, 'El movimiento no existe.');
    const anterior = filas[0];
    verificarQueNoEsAutomatico(anterior);

    const efectoAnterior = calcularEfecto(anterior.tipo, anterior.cantidad);
    const efectoNuevo = calcularEfecto(datos.tipo, datos.cantidad);

    if (anterior.id_producto === datos.id_producto) {
      // Mismo producto: stock - efecto anterior + efecto nuevo.
      const producto = await bloquearProducto(conexion, datos.id_producto);
      const nuevoStock = producto.stock - efectoAnterior + efectoNuevo;
      verificarRango(
        nuevoStock,
        `El cambio supera el stock máximo de ${STOCK_MAXIMO} unidades: el stock de "${producto.nombre}" quedaría en ${nuevoStock}.`,
        `El cambio deja el stock en negativo: el stock de "${producto.nombre}" quedaría en ${nuevoStock}.`
      );
      await guardarStock(conexion, producto, nuevoStock);
    } else {
      // Cambió el producto: se revierte en el producto viejo y se aplica en el nuevo.
      // Se bloquean en orden de ID para evitar bloqueos cruzados.
      const [idMenor, idMayor] = [anterior.id_producto, datos.id_producto].sort((a, b) => a - b);
      const primero = await bloquearProducto(conexion, idMenor);
      const segundo = await bloquearProducto(conexion, idMayor);
      const productoAnterior = primero.id_producto === anterior.id_producto ? primero : segundo;
      const productoNuevo = primero.id_producto === datos.id_producto ? primero : segundo;

      const stockAnteriorRevertido = productoAnterior.stock - efectoAnterior;
      verificarRango(
        stockAnteriorRevertido,
        `Al quitar este movimiento de "${productoAnterior.nombre}", su stock quedaría en ${stockAnteriorRevertido} y supera el máximo de ${STOCK_MAXIMO}.`,
        `Al quitar este movimiento de "${productoAnterior.nombre}", su stock quedaría en ${stockAnteriorRevertido} (negativo).`
      );

      const stockNuevoAplicado = productoNuevo.stock + efectoNuevo;
      verificarRango(
        stockNuevoAplicado,
        `La entrada supera el stock máximo de ${STOCK_MAXIMO} unidades: "${productoNuevo.nombre}" quedaría con ${stockNuevoAplicado}.`,
        `La salida deja el stock en negativo: "${productoNuevo.nombre}" quedaría con ${stockNuevoAplicado}.`
      );

      await guardarStock(conexion, productoAnterior, stockAnteriorRevertido);
      await guardarStock(conexion, productoNuevo, stockNuevoAplicado);
    }

    await conexion.execute(
      `UPDATE movimientos
          SET id_producto = ?, id_empleado = ?, tipo = ?, cantidad = ?, fecha = ?, motivo = ?
        WHERE id_movimiento = ?`,
      [datos.id_producto, datos.id_empleado, datos.tipo, datos.cantidad, datos.fecha, datos.motivo, id]
    );
  });
}

// ---------------------------------------------------------------------
// Eliminar: revierte el efecto del movimiento.
// ---------------------------------------------------------------------
export async function eliminar(id) {
  return enTransaccion(async (conexion) => {
    const [filas] = await conexion.execute('SELECT * FROM movimientos WHERE id_movimiento = ? FOR UPDATE', [id]);
    if (filas.length === 0) throw new ErrorHttp(404, 'El movimiento no existe.');
    const movimiento = filas[0];
    verificarQueNoEsAutomatico(movimiento);

    const producto = await bloquearProducto(conexion, movimiento.id_producto);
    const nuevoStock = producto.stock - calcularEfecto(movimiento.tipo, movimiento.cantidad);
    verificarRango(
      nuevoStock,
      `No se puede eliminar esta salida: el stock de "${producto.nombre}" quedaría en ${nuevoStock} y supera el máximo de ${STOCK_MAXIMO}.`,
      `No se puede eliminar esta entrada: el stock de "${producto.nombre}" quedaría en ${nuevoStock}, porque parte de esas unidades ya salieron.`
    );

    await conexion.execute('DELETE FROM movimientos WHERE id_movimiento = ?', [id]);
    await guardarStock(conexion, producto, nuevoStock);
    return { stockResultante: nuevoStock, nombreProducto: producto.nombre };
  });
}
