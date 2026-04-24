// src/commands/venta.js
// Registra una venta y descuenta stock. Requiere confirmación de dos pasos.
// Flujo: VENTA SKU CANT → confirma → CONFIRMAR

const db = require('../services/database');
const { getClient } = require('../services/database');

const ROLES_PERMITIDOS = ['admin', 'encargado', 'vendedor'];

/**
 * Maneja el comando VENTA [sku] [cantidad]
 */
async function handleVenta(user, args) {
  if (!ROLES_PERMITIDOS.includes(user.role)) {
    return 'No tenés permiso para registrar ventas. Enviá AYUDA.';
  }

  if (args.length < 2) {
    return 'Formato: VENTA [producto] [cantidad]\nEjemplo: VENTA YERBA 5';
  }

  const qty = parseInt(args[args.length - 1], 10);
  if (isNaN(qty) || qty <= 0) {
    return `Cantidad inválida: "${args[args.length - 1]}"\nEjemplo: VENTA YERBA 5`;
  }

  const productQuery = args.slice(0, -1).join(' ');
  const products = await db.getStock(productQuery);

  if (!products || products.length === 0) {
    return `No encontré "${productQuery}" en el sistema.`;
  }

  if (products.length > 1) {
    const opciones = products.map((p, i) => `${i + 1}. ${p.name} (${p.sku})`).join('\n');
    return `Encontré varios productos:\n${opciones}\nSé más específico: VENTA [SKU] ${qty}`;
  }

  const product = products[0];

  if (product.stock_qty < qty) {
    return `Stock insuficiente.\n${product.name}: ${product.stock_qty} ${product.unit || 'uds'} disponibles.\nSolicitás: ${qty}`;
  }

  // Guardar operación pendiente de confirmación
  await savePendingOperation(user.id, {
    type: 'VENTA',
    productId: product.id,
    productName: product.name,
    qty,
    userId: user.id,
    phone: user.phone,
  });

  const total = product.stock_qty - qty;
  return `⚡ Confirmá la venta:\n${product.name} × ${qty} ${product.unit || 'uds'}\nStock resultante: ${total} ${product.unit || 'uds'}\nRespondé CONFIRMAR para registrar o CANCELAR para anular.`;
}

/**
 * Guarda una operación pendiente en Supabase (tabla pending_ops).
 * Se limpia automáticamente por TTL de 10 minutos.
 */
async function savePendingOperation(userId, data) {
  const supabase = getClient();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Reemplazar cualquier operación pendiente anterior del mismo usuario
  await supabase.from('pending_ops').upsert({
    user_id: userId,
    data: JSON.stringify(data),
    expires_at: expiresAt,
  }, { onConflict: 'user_id' });
}

module.exports = { handleVenta, ROLES_PERMITIDOS };
