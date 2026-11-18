// Unidades APARTADAS: las que están en pedidos activos de clientes.
// Pedido activo = estado 'pendiente' o 'confirmado' y todavía sin vencer (vence_en en el futuro).
//
// Analogía: es como apartar ropa en una tienda. La prenda sigue en el local
// (el stock no cambia), pero ya no se le puede vender a otra persona.
//   disponible para vender = stock - apartado
import pool from '../config/db.js';

export const CONDICION_PEDIDO_ACTIVO = "pe.estado IN ('pendiente', 'confirmado') AND pe.vence_en > NOW()";

// Subconsulta SQL con las unidades apartadas del producto (alias de la tabla productos).
export function sqlApartado(alias = 'p') {
  // CAST: así MySQL lo devuelve como número entero y no como texto decimal.
  return `CAST((SELECT COALESCE(SUM(dp.cantidad), 0)
                  FROM detalle_pedidos dp JOIN pedidos pe ON pe.id_pedido = dp.id_pedido
                 WHERE dp.id_producto = ${alias}.id_producto AND ${CONDICION_PEDIDO_ACTIVO}) AS SIGNED)`;
}

// Unidades apartadas de un producto (puede excluir un pedido, por ejemplo el que se está entregando).
export async function unidadesApartadas(conexion, idProducto, idPedidoExcluido = null) {
  const [[fila]] = await (conexion ?? pool).execute(
    `SELECT COALESCE(SUM(dp.cantidad), 0) AS apartado
       FROM detalle_pedidos dp JOIN pedidos pe ON pe.id_pedido = dp.id_pedido
      WHERE dp.id_producto = ? AND ${CONDICION_PEDIDO_ACTIVO} AND pe.id_pedido <> ?`,
    [idProducto, idPedidoExcluido ?? 0]
  );
  return Number(fila.apartado);
}
