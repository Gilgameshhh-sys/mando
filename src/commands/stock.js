// src/commands/stock.js
// Consulta de stock en tiempo real.
// Solo requiere rol de lectura (vendedor, operario, encargado, admin).

const db = require('../services/database');

const ROLES_PERMITIDOS = ['admin', 'encargado', 'vendedor', 'operario'];

/**
 * Maneja el comando STOCK [producto]
 * @param {object} user  - Usuario autenticado (req.user)
 * @param {string[]} args - Argumentos del comando (ej: ['YERBA'])
 * @returns {string} - Respuesta SMS
 */
async function handleStock(user, args) {
  // Validar rol
  if (!ROLES_PERMITIDOS.includes(user.role)) {
    return 'No tenés permiso para consultar stock. Enviá AYUDA para ver tus comandos.';
  }

  // Validar que se especificó un producto
  if (!args.length) {
    return 'Formato: STOCK [producto]\nEjemplo: STOCK YERBA';
  }

  const productQuery = args.join(' ');

  const products = await db.getStock(productQuery);

  if (!products || products.length === 0) {
    return `No encontré "${productQuery}" en el sistema.\nVerificá el nombre o enviá STOCK sin argumentos para ver todos.`;
  }

  // Formatear respuesta (breve para SMS)
  const lines = products.map((p) => {
    const alerta = p.stock_qty <= p.min_stock ? ' ⚠ Mínimo' : '';
    return `${p.name}: ${p.stock_qty} ${p.unit || 'uds'}${alerta}`;
  });

  const header = products.length === 1 ? '📦 Stock:' : `📦 Stock (${products.length} productos):`;
  return `${header}\n${lines.join('\n')}\n— ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

module.exports = { handleStock, ROLES_PERMITIDOS };
