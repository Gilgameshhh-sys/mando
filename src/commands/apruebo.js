// src/commands/apruebo.js
// Aprueba una orden. Solo encargados y admins. Notifica al chofer.

const db = require('../services/database');
const { sendSMS } = require('../services/sms');

const ROLES_PERMITIDOS = ['admin', 'encargado'];

/**
 * Maneja el comando APRUEBO [nro_pedido]
 */
async function handleApruebo(user, args) {
  if (!ROLES_PERMITIDOS.includes(user.role)) {
    return 'No tenés permiso para aprobar pedidos.\nSolo encargados y admins pueden usar APRUEBO.';
  }

  if (!args.length) {
    return 'Formato: APRUEBO [número de pedido]\nEjemplo: APRUEBO 1942';
  }

  const orderId = args[0];

  const result = await db.approveOrder({
    orderId,
    approverId: user.id,
    approverPhone: user.phone,
  });

  if (!result.found) {
    return `No encontré el pedido #${orderId}.`;
  }

  if (result.alreadyApproved) {
    return `El pedido #${orderId} ya fue aprobado anteriormente.`;
  }

  if (result.invalidStatus) {
    return `El pedido #${orderId} no puede aprobarse desde estado "${result.status}".\nSolo se pueden aprobar pedidos pendientes o con llegada registrada.`;
  }

  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // Notificar al chofer en paralelo
  if (result.driver?.phone) {
    const notif = `✅ Mando: Pedido #${orderId} aprobado por ${user.name} (${hora}).\nProcedé con la entrega.`;
    sendSMS(result.driver.phone, notif).catch(() => {});
  }

  let respuesta = `✅ Pedido #${orderId} aprobado — ${hora}`;
  if (result.driver?.name) {
    respuesta += `\n${result.driver.name} fue notificado.`;
  }
  respuesta += '\nAuditoría guardada.';

  return respuesta;
}

module.exports = { handleApruebo, ROLES_PERMITIDOS };
