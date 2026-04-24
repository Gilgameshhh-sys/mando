// src/services/sms.js
// Wrapper de Twilio. Abstrae el envío de SMS y la validación de webhooks.

const twilio = require('twilio');
const config = require('../config');
const { logger } = require('../middleware/logger');

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * Envía un SMS a un número de destino.
 * Retorna el SID del mensaje o lanza error.
 */
async function sendSMS(to, body) {
  if (!to || !body) throw new Error('sendSMS: to y body son requeridos');

  // Recortar si excede el límite de SMS (160 chars por segmento)
  // Para MVP dejamos que Twilio divida en múltiples segmentos si hace falta
  const truncated = body.length > 480 ? body.slice(0, 477) + '...' : body;

  try {
    const message = await client.messages.create({
      from: config.twilio.phoneNumber,
      to,
      body: truncated,
    });
    logger.info('SMS enviado', { to, sid: message.sid, length: truncated.length });
    return message.sid;
  } catch (err) {
    logger.error('Error enviando SMS', { to, error: err.message });
    throw err;
  }
}

/**
 * Middleware Express: valida la firma de Twilio en el webhook.
 * Si VALIDATE_TWILIO_SIGNATURE=false (dev), pasa directamente.
 */
function twilioSignatureMiddleware(req, res, next) {
  if (!config.twilio.validateSignature || config.app.isDev) {
    return next();
  }

  const signature = req.headers['x-twilio-signature'];
  const url = `${config.app.url}${req.originalUrl}`;
  const isValid = twilio.validateRequest(
    config.twilio.authToken,
    signature,
    url,
    req.body
  );

  if (!isValid) {
    logger.warn('Firma de Twilio inválida', { url, signature });
    return res.status(403).send('Forbidden');
  }

  next();
}

/**
 * Genera la respuesta TwiML vacía.
 * Twilio espera una respuesta HTTP 200. El SMS de respuesta se envía
 * por API separada para tener más control (logs, reintentos, etc.)
 */
function twimlOk(res) {
  res.set('Content-Type', 'text/xml');
  res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

module.exports = { sendSMS, twilioSignatureMiddleware, twimlOk };
