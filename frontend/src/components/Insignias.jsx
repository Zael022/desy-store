// Pequeñas etiquetas de color: disponibilidad de un producto y estado de un registro.
import { TEXTO_DISPONIBILIDAD } from '../utils/formato.js';

// "disponible" | "pocas" | "agotado"  (el cliente nunca ve el número exacto)
export function InsigniaDisponibilidad({ valor }) {
  return <span className={`insignia insignia-${valor}`}>{TEXTO_DISPONIBILIDAD[valor] ?? valor}</span>;
}

const TEXTO_ESTADOS = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
  activo: 'Activa',
  inactivo: 'Desactivada',
  invitacion: 'Invitación pendiente'
};

export function InsigniaEstado({ estado }) {
  return <span className={`insignia insignia-estado-${estado}`}>{TEXTO_ESTADOS[estado] ?? estado}</span>;
}

// Estado de un pedido de cliente.
const TEXTO_ESTADO_PEDIDO = {
  pendiente: 'Esperando confirmación',
  confirmado: 'Listo para recoger',
  entregado: 'Entregado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
  vencido: 'Vencido'
};

export function InsigniaPedido({ estado }) {
  return <span className={`insignia insignia-pedido-${estado}`}>{TEXTO_ESTADO_PEDIDO[estado] ?? estado}</span>;
}
