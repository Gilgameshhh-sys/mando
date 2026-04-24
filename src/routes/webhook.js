// src/routes/webhook.js
// Ruta principal del webhook SMS. Recibe, parsea, despacha y responde.

const express = require('express');
const router = express.Router();

const { twilioSignatureMiddleware, sendSMS, twimlOk } = require('../services/sms');
const { authenticate } = require('../middleware/auth');
const { parseMessage, isValidCommand } = require('../utils/parser');
const { auditLog, logger } = require('../middleware/logger');
const { getClient } = require('../services/database');

// Handlers de comandos
const { handleStock } = require('../commands/stock');
const { handleVenta } = require('../commands/venta');
const { handleLlegue } = require('../commands/llegue');
const { handleStatus } = require('../commands/status');
const { handleApruebo } = require('../commands/apruebo');
const { handleAyuda, handleConfirmar, handleCancelar } = require('../commands/ayuda');

/**
 * POST /webhook/sms
 * Twilio envía un POST con cada SMS recibido.
 * Body: { From, Body, MessageSid, ... }
 */
router.post(
  '/sms',
  twilioSignatureMiddleware,
  express.urlencoded({ extended: false }), // Twilio envía form-encoded
  authenticate,
  async (req, res) => {
    // Responder inmediatamente a Twilio (evita timeout de 15s)
    twimlOk(res);

    const rawBody = req.body?.Body || '';
    const from = req.body?.From || req.unauthorizedPhone;
    const { command, args, raw } = parseMessage(rawBody);

    // Log entrada
    logger.info('SMS recibido', { from, raw, command, args });

    let responseText = '';
    let success = false;
    let errorMsg = null;

    try {
      // ── Usuarios no autorizados ────────────────────────────────
      if (!req.user) {
        const reason = req.unauthorizedReason;
        if (reason === 'inactive') {
          responseText = 'Tu cuenta Mando está inactiva.\nComunicáte con el administrador para reactivarla.';
        } else {
          responseText = 'Número no registrado en Mando.\nComunicáte con tu administrador para dar de alta tu celular.';
        }

        await sendSMS(from, responseText);
        await auditLog(getClient(), { phone: from, command, args, result: 'unauthorized', success: false });
        return;
      }

      const user = req.user;

      // ── Despachar comando ─────────────────────────────────────
      switch (command) {
        case 'STOCK':
          responseText = await handleStock(user, args);
          break;

        case 'VENTA':
          responseText = await handleVenta(user, args);
          break;

        case 'LLEGUE':
          responseText = await handleLlegue(user, args);
          break;

        case 'STATUS':
          responseText = await handleStatus(user, args);
          break;

        case 'APRUEBO':
          responseText = await handleApruebo(user, args);
          break;

        case 'AYUDA':
          responseText = handleAyuda(user);
          break;

        case 'CONFIRMAR':
          responseText = await handleConfirmar(user);
          break;

        case 'CANCELAR':
          responseText = await handleCancelar(user);
          break;

        case null:
        case undefined:
          responseText = 'Mensaje vacío recibido.\nEnviá AYUDA para ver los comandos disponibles.';
          break;

        default:
          if (!isValidCommand(command)) {
            responseText = `Comando "${command}" no reconocido.\nEnviá AYUDA para ver los comandos disponibles.`;
          }
      }

      success = true;
    } catch (err) {
      logger.error('Error procesando comando', {
        from,
        command,
        error: err.message,
        stack: err.stack,
      });
      errorMsg = err.message;
      responseText = 'Hubo un error procesando tu comando. Intentá nuevamente en unos minutos.\nSi el problema persiste, avisale al administrador.';
    }

    // Enviar respuesta SMS
    if (responseText && from) {
      await sendSMS(from, responseText).catch((err) => {
        logger.error('Error enviando respuesta SMS', { from, error: err.message });
      });
    }

    // Registrar en auditoría
    await auditLog(getClient(), {
      phone: from,
      userId: req.user?.id,
      command: raw,
      args: args.join(' '),
      result: responseText,
      success,
      errorMsg,
    });
  }
);

/**
 * GET /webhook/health
 * Ping de disponibilidad para Railway/UptimeRobot.
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), service: 'mando-webhook' });
});

module.exports = router;
