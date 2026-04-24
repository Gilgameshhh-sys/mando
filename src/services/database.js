// src/services/database.js
// Singleton de Supabase. Usa service key para operaciones de backend.

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const { logger } = require('../middleware/logger');

let _client = null;

function getClient() {
  if (!_client) {
    _client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false },
    });
    logger.info('Supabase client inicializado');
  }
  return _client;
}

/**
 * Consulta stock de un producto por nombre o alias.
 * Retorna null si no se encuentra.
 */
async function getStock(productQuery) {
  const db = getClient();
  const query = productQuery.toLowerCase().trim();

  const { data, error } = await db
    .from('products')
    .select('id, name, sku, stock_qty, min_stock, unit, location')
    .or(`name.ilike.%${query}%,sku.ilike.%${query}%,aliases.cs.{"${query}"}`)
    .limit(3);

  if (error) throw new Error(`DB error en getStock: ${error.message}`);
  return data;
}

/**
 * Descuenta stock. Retorna el nuevo stock o lanza error si no hay suficiente.
 */
async function registerSale({ productId, qty, userId, phone }) {
  const db = getClient();

  // Usamos una función RPC de Supabase para hacer el decrement atómico
  const { data, error } = await db.rpc('decrement_stock', {
    p_product_id: productId,
    p_qty: qty,
    p_user_id: userId,
    p_phone: phone,
  });

  if (error) throw new Error(`DB error en registerSale: ${error.message}`);
  return data; // { success, new_stock, product_name }
}

/**
 * Registra llegada de chofer a cliente.
 */
async function registerArrival({ clientCode, userId, phone }) {
  const db = getClient();

  // 1. Buscar cliente
  const { data: client, error: clientErr } = await db
    .from('clients')
    .select('id, name, current_order_id')
    .or(`code.ilike.${clientCode},name.ilike.%${clientCode}%`)
    .single();

  if (clientErr || !client) return { found: false };

  // 2. Registrar evento de llegada
  const { error: eventErr } = await db.from('delivery_events').insert({
    client_id: client.id,
    order_id: client.current_order_id,
    user_id: userId,
    phone,
    event_type: 'arrived',
  });

  if (eventErr) throw new Error(`DB error en registerArrival: ${eventErr.message}`);

  // 3. Obtener detalle de la orden si existe
  let order = null;
  if (client.current_order_id) {
    const { data: orderData } = await db
      .from('orders')
      .select('id, items_summary, status')
      .eq('id', client.current_order_id)
      .single();
    order = orderData;
  }

  return { found: true, client, order };
}

/**
 * Consulta estado de una orden por número.
 */
async function getOrderStatus(orderId) {
  const db = getClient();

  const { data, error } = await db
    .from('orders')
    .select('id, status, client:clients(name), driver:users(name), updated_at')
    .eq('id', orderId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Aprueba una orden. Solo disponible para roles con permiso.
 */
async function approveOrder({ orderId, approverId, approverPhone }) {
  const db = getClient();

  // 1. Verificar que existe y está pendiente
  const { data: order, error: fetchErr } = await db
    .from('orders')
    .select('id, status, driver_id, client_id')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) return { found: false };
  if (order.status === 'approved') return { alreadyApproved: true };
  if (!['pending', 'arrived'].includes(order.status)) return { invalidStatus: true, status: order.status };

  // 2. Actualizar estado
  const { error: updateErr } = await db
    .from('orders')
    .update({ status: 'approved', approved_by: approverId, approved_at: new Date().toISOString() })
    .eq('id', orderId);

  if (updateErr) throw new Error(`DB error en approveOrder: ${updateErr.message}`);

  // 3. Obtener teléfono del chofer para notificarle
  const { data: driver } = await db
    .from('users')
    .select('phone, name')
    .eq('id', order.driver_id)
    .single();

  return { found: true, approved: true, driver };
}

/**
 * Obtiene los comandos disponibles para un rol dado.
 */
function getCommandsForRole(role) {
  const roleCommands = {
    admin: ['STOCK', 'VENTA', 'LLEGUE', 'STATUS', 'APRUEBO', 'AYUDA'],
    encargado: ['STOCK', 'VENTA', 'LLEGUE', 'STATUS', 'APRUEBO', 'AYUDA'],
    vendedor: ['STOCK', 'VENTA', 'STATUS', 'AYUDA'],
    chofer: ['LLEGUE', 'STATUS', 'AYUDA'],
    operario: ['STOCK', 'STATUS', 'AYUDA'],
  };
  return roleCommands[role] || ['AYUDA'];
}

module.exports = {
  getClient,
  getStock,
  registerSale,
  registerArrival,
  getOrderStatus,
  approveOrder,
  getCommandsForRole,
};
