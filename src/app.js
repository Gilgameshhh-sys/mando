// src/app.js
// Entry point de la aplicación. Configura Express y arranca el servidor.

const express = require('express');
const config = require('./config');
const { logger } = require('./middleware/logger');
const webhookRouter = require('./routes/webhook');

const app = express();

// ─── Middlewares globales ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Seguridad básica: header X-Powered-By off
app.disable('x-powered-by');

// Logging de cada request entrante
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ─── Rutas ────────────────────────────────────────────────────────
app.use('/webhook', webhookRouter);

// Root: info básica (útil en dev, noop en prod)
app.get('/', (req, res) => {
  res.json({
    service: 'Mando SMS Platform',
    version: '1.0.0',
    status: 'running',
    webhook: '/webhook/sms',
  });
});

// ─── Error handler global ─────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Error no manejado', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

// ─── Arranque ─────────────────────────────────────────────────────
const server = app.listen(config.app.port, () => {
  logger.info(`🚀 Mando corriendo en puerto ${config.app.port} [${config.app.env}]`);
  logger.info(`   Webhook: ${config.app.url}/webhook/sms`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido — cerrando servidor...');
  server.close(() => {
    logger.info('Servidor cerrado.');
    process.exit(0);
  });
});

module.exports = app; // Para tests
