// Correos al cliente cuando su pedido cambia de estado (recibido, confirmado, rechazado, vencido).
//
// Son "de cortesía": si el correo falla (Gmail caído, sin configurar...), el pedido
// IGUAL cambia de estado y el cliente lo ve en "Mis pedidos". Por eso aquí los
// errores se anotan en la consola y no se le muestran a quien atendió el pedido.
import { configuracion } from '../config/env.js';
import { enviarCorreo } from './notificaciones.js';

const formatoColones = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 });
const formatoFecha = new Intl.DateTimeFormat('es-CR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Costa_Rica' });

const escapar = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function lineas(pedido) {
  return pedido.detalle.map((d) => `- ${d.cantidad} x ${d.nombre_producto} (${formatoColones.format(d.subtotal)})`).join('\n');
}

function mensaje(pedido, tipo) {
  const numero = `#${pedido.id_pedido}`;
  const total = formatoColones.format(pedido.total);
  const plazo = formatoFecha.format(new Date(pedido.vence_en));
  switch (tipo) {
    case 'recibido':
      return {
        asunto: `Desy · Recibimos su pedido ${numero}`,
        intro: `Hola, ${pedido.nombre_cliente}. Recibimos su pedido ${numero} por ${total}. Las unidades quedaron apartadas mientras la tienda lo revisa. Le avisaremos cuando esté confirmado (a más tardar el ${plazo}).`
      };
    case 'confirmado':
      return {
        asunto: `Desy · Su pedido ${numero} está confirmado`,
        intro: `Hola, ${pedido.nombre_cliente}. Su pedido ${numero} está confirmado y listo para recoger en la tienda. Lo pagará al recogerlo (${total}). Tiene hasta el ${plazo}; después las unidades se liberan.`
      };
    case 'rechazado':
      return {
        asunto: `Desy · Su pedido ${numero} no se pudo atender`,
        intro: `Hola, ${pedido.nombre_cliente}. La tienda no pudo atender su pedido ${numero}. Motivo: ${pedido.motivo}. Las unidades ya no están apartadas.`
      };
    case 'vencido':
      return {
        asunto: `Desy · Su pedido ${numero} venció`,
        intro: `Hola, ${pedido.nombre_cliente}. Su pedido ${numero} venció (${pedido.motivo?.toLowerCase() ?? 'se acabó el plazo'}) y las unidades se liberaron. Si todavía lo quiere, puede hacer un pedido nuevo.`
      };
    default:
      return null;
  }
}

// Envía el aviso. Nunca lanza errores: devuelve true si se envió.
export async function avisarPedido(pedido, tipo) {
  const datos = mensaje(pedido, tipo);
  if (!datos || !pedido.correo_cliente) return false;
  const enlace = `${configuracion.frontendUrl}/cliente/pedidos`;
  const texto = `${datos.intro}\n\n${lineas(pedido)}\n\nVea sus pedidos en: ${enlace}`;
  const html =
    `<p>${escapar(datos.intro)}</p><ul>${pedido.detalle.map((d) => `<li>${d.cantidad} x ${escapar(d.nombre_producto)} (${formatoColones.format(d.subtotal)})</li>`).join('')}</ul>` +
    `<p><a href="${escapar(enlace)}">Ver mis pedidos</a></p>`;
  try {
    await enviarCorreo({ para: pedido.correo_cliente, asunto: datos.asunto, texto, html });
    return true;
  } catch (error) {
    console.error(`[Pedidos] No se pudo enviar el aviso "${tipo}" del pedido #${pedido.id_pedido}: ${error.message}`);
    return false;
  }
}
