// src/commands/status.js
// Consulta estado de una orden. Disponible para todos los roles autorizados.

const db = require('../services/database');

const ROLES_PERMITIDOS = ['admin', 'encargado', 'vendedor', 'chofer', 'operario'];

const STATUS_LABELS = {
  pending:   'Pendiente ⏳',
  in_transit: 'En camino 🚛',
  arrived:   'Llegó — esperando descarga 📍',
  approved:  'Aprobado ✅',
  delivered: 'Entregado ✅',
  cancelled: 'Cancelado ❌',
  issue:     'Con incidencia ⚠',
};

/**
 * Maneja el comando STATUS [nro_pedido]
 */
async function handleStatus(user, args) {
  if (!ROLES_PERMITIDOS.includes(user.role)) {
    return 'No tenés permiso para consultar estados. Enviá AYUDA.';
  }

  if (!args.length) {
    return 'Formato: STATUS [número de pedido]\nEjemplo: STATUS 1942';
  }

  const orderId = args[0];
  const order = await db.getOrderStatus(orderId);

  if (!order) {
    return `No encontré el pedido #${orderId}.\nVerificá el número o contactá al encargado.`;
  }

  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const hora = new Date(order.updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  let respuesta = `📋 Pedido #${order.id}\nEstado: ${statusLabel}`;

  if (order.client?.name) respuesta += `\nCliente: ${order.client.name}`;
  if (order.driver?.name) respuesta += `\nChofer: ${order.driver.name}`;
  respuesta += `\nÚltima actualización: ${hora}`;

  return respuesta;
}

module.exports = { handleStatus, ROLES_PERMITIDOS };
