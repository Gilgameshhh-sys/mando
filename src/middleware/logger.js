// src/middleware/logger.js
// Logger estructurado con Winston. Cada acción queda registrada.

const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Siempre loguear a consola (Railway/Vercel captura stdout)
    new winston.transports.Console({
      format: config.app.isDev
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const extras = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}] ${message} ${extras}`;
            })
          )
        : winston.format.json(),
    }),
  ],
});

/**
 * Registra cada ejecución de comando en la tabla audit_logs de Supabase.
 * Se llama después de cada comando, tanto exitoso como fallido.
 */
async function auditLog(supabase, { phone, userId, command, args, result, success, errorMsg }) {
  try {
    await supabase.from('audit_logs').insert({
      phone,
      user_id: userId || null,
      raw_command: command,
      args: args || null,
      result: result || null,
      success,
      error_msg: errorMsg || null,
    });
  } catch (err) {
    // Nunca romper el flujo por un error de logging
    logger.warn('No se pudo escribir audit_log', { error: err.message });
  }
}

module.exports = { logger, auditLog };
