// src/commands/ayuda.js
// Lista los comandos disponibles para el rol del usuario.
// También maneja CONFIRMAR y CANCELAR (operaciones de dos pasos).

const { getClient } = require('../services/database');
const db = require('../services/database');

const COMMAND_DESCRIPTIONS = {
  STOCK:   'STOCK [producto] — Consulta stock en tiempo real',
  VENTA:   'VENTA [producto] [cant] — Registra una venta',
  LLEGUE:  'LLEGUE [cliente] — Reporta llegada a destino',
  STATUS:  'STATUS [pedido] — Consulta estado de un pedido',
  APRUEBO: 'APRUEBO [pedido] — Aprueba un pedido (solo encargados)',
  AYUDA:   'AYUDA — Muestra este menú',
};

/**
 * Maneja el comando AYUDA
 */
function handleAyuda(user) {
  const commands = db.getCommandsForRole(user.role);
  const lines = commands.map((cmd) => COMMAND_DESCRIPTIONS[cmd] || cmd);
  return `📋 Tus comandos (${user.role}):\n${lines.join('\n')}\n\nMando — mando.ar`;
}

/**
 * Maneja CONFIRMAR — ejecuta la operación pendiente del usuario.
 */
async function handleConfirmar(user) {
  const supabase = getClient();

  const { data: pending, error } = await supabase
    .from('pending_ops')
    .select('data, expires_at')
    .eq('user_id', user.id)
    .single();

  if (error || !pending) {
    return 'No tenés ninguna operación pendiente de confirmar.\nEnviá el comando nuevamente si querés ejecutarlo.';
  }

  // Verificar que no expiró
  if (new Date(pending.expires_at) < new Date()) {
    await supabase.from('pending_ops').delete().eq('user_id', user.id);
    return 'La operación expiró (más de 10 minutos). Enviá el comando nuevamente.';
  }

  const op = JSON.parse(pending.data);

  // Limpiar la operación pendiente
  await supabase.from('pending_ops').delete().eq('user_id', user.id);

  // Ejecutar según el tipo de operación
  if (op.type === 'VENTA') {
    const result = await db.registerSale({
      productId: op.productId,
      qty: op.qty,
      userId: user.id,
      phone: user.phone,
    });

    if (!result.success) {
      return `No se pudo registrar la venta. Stock insuficiente o error en BD.\nComunicáte con el administrador.`;
    }

    const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return `✅ Venta registrada — ${hora}\n${op.productName} × ${op.qty} uds.\nNuevo stock: ${result.new_stock} uds.\nAuditoría guardada.`;
  }

  return 'Tipo de operación desconocido. Intentá nuevamente.';
}

/**
 * Maneja CANCELAR — limpia la operación pendiente.
 */
async function handleCancelar(user) {
  const supabase = getClient();
  await supabase.from('pending_ops').delete().eq('user_id', user.id);
  return '❌ Operación cancelada.\nNo se realizó ningún cambio.';
}

module.exports = { handleAyuda, handleConfirmar, handleCancelar };
