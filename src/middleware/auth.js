// src/middleware/auth.js
// Identifica al remitente por número de celular y carga su perfil + rol.

const { getClient } = require('../services/database');
const { logger } = require('./logger');

/**
 * Normaliza el número de teléfono al formato E.164.
 * Twilio siempre envía en E.164 (+54...) pero lo normalizamos igual.
 */
function normalizePhone(raw) {
  if (!raw) return null;
  return raw.replace(/\s+/g, '').trim();
}

/**
 * Middleware de autenticación.
 * Adjunta req.user = { id, name, phone, role, clientId } o responde 'No autorizado'.
 * También valida si el usuario está activo.
 */
async function authenticate(req, res, next) {
  const rawPhone = req.body?.From || req.body?.from;
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    logger.warn('Webhook recibido sin número de teléfono');
    return res.status(400).send('Bad Request');
  }

  try {
    const db = getClient();
    const { data: user, error } = await db
      .from('users')
      .select('id, name, phone, role, active, client_id')
      .eq('phone', phone)
      .single();

    if (error || !user) {
      logger.info('Número no autorizado', { phone });
      req.unauthorizedPhone = phone;
      req.unauthorizedReason = 'not_found';
      return next(); // Dejamos que el handler responda con mensaje amigable
    }

    if (!user.active) {
      logger.info('Usuario inactivo intentó usar el sistema', { phone, userId: user.id });
      req.unauthorizedPhone = phone;
      req.unauthorizedReason = 'inactive';
      return next();
    }

    req.user = user;
    logger.info('Usuario autenticado', { phone, role: user.role, name: user.name });
    next();
  } catch (err) {
    logger.error('Error en autenticación', { phone, error: err.message });
    next(err);
  }
}

/**
 * Factory: crea un middleware que valida si el usuario tiene el rol requerido.
 * Uso: router.post('/webhook', authenticate, requireRole(['admin', 'encargado']), handler)
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(); // Ya manejado por authenticate
    if (allowedRoles.includes(req.user.role)) return next();
    req.forbiddenRole = true;
    next();
  };
}

module.exports = { authenticate, requireRole, normalizePhone };
