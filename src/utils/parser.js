// src/utils/parser.js
// Parsea el texto del SMS en { command, args }.
// Diseñado para ser tolerante: mayúsculas, tildes, espacios extras.

/**
 * Normaliza un string para comparación:
 * - Mayúsculas
 * - Elimina tildes
 * - Trim y comprime espacios múltiples
 */
function normalize(text) {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina diacríticos
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parsea el body del SMS y retorna { command, args, raw }
 * command: string en mayúsculas (ej: 'STOCK')
 * args: array de strings con los argumentos restantes
 * raw: texto original
 */
function parseMessage(rawBody) {
  if (!rawBody || typeof rawBody !== 'string') {
    return { command: null, args: [], raw: rawBody || '' };
  }

  const normalized = normalize(rawBody);
  const parts = normalized.split(' ').filter(Boolean);

  if (!parts.length) {
    return { command: null, args: [], raw: rawBody };
  }

  const command = parts[0];
  const args = parts.slice(1);

  return { command, args, raw: rawBody.trim() };
}

/**
 * Comandos válidos del sistema.
 * Centralizado aquí para validar antes de despachar.
 */
const VALID_COMMANDS = ['STOCK', 'VENTA', 'LLEGUE', 'STATUS', 'APRUEBO', 'AYUDA'];

/**
 * Retorna true si el comando es reconocido por el sistema.
 */
function isValidCommand(command) {
  return VALID_COMMANDS.includes(command);
}

module.exports = { parseMessage, normalize, isValidCommand, VALID_COMMANDS };
