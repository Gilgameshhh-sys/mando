// src/commands/llegue.js
// Registra la llegada de un chofer al cliente. Notifica al encargado.

const db = require('../services/database');
const { sendSMS } = require('../services/sms');
const config = require('../config');

const ROLES_PERMITIDOS = ['admin', 'encargado', 'chofer'];

/**
 * Maneja el comando LLEGUE [cliente]
 */
async function handleLlegue(user, args) {
  if (!ROLES_PERMITIDOS.includes(user.role)) {
    return 'No tenés permiso para reportar llegadas. Enviá AYUDA.';
  }

  if (!args.length) {
    return 'Formato: LLEGUE [código cliente]\nEjemplo: LLEGUE CLIENTE23';
  }

  const clientCode = args.join(' ');
  const result = await db.registerArrival({
    clientCode,
    userId: user.id,
    phone: user.phone,
  });

  if (!result.found) {
    return `No encontré el cliente "${clientCode}".\nVerificá el código o pedíle el listado al encargado.`;
  }

  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // Notificar al admin/encargado en paralelo (no bloqueamos la respuesta)
  if (config.admin.phone) {
    const notif = `🚛 Mando: ${user.name} llegó a ${result.client.name} (${hora})${result.order ? `\nPedido #${result.order.id} listo para entrega.` : ''}`;
    sendSMS(config.admin.phone, notif).catch(() => {}); // Fire & forget
  }

  let respuesta = `✅ Llegada registrada — ${hora}\nCliente: ${result.client.name}`;

  if (result.order) {
    respuesta += `\nPedido #${result.order.id} pendiente de entrega.\n${result.order.items_summary || ''}`;
  } else {
    respuesta += '\nSin pedido activo registrado.';
  }

  return respuesta;
}

module.exports = { handleLlegue, ROLES_PERMITIDOS };
