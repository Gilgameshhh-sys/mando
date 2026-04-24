// src/config.js
// Centraliza toda la configuración. Falla rápido si falta algo crítico.

require('dotenv').config();

function required(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Variable de entorno requerida: ${key}`);
  return val;
}

const config = {
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    url: process.env.APP_URL || 'http://localhost:3000',
    isDev: (process.env.NODE_ENV || 'development') === 'development',
  },

twilio: {
  accountSid: required('TWILIO_ACCOUNT_SID'),
  authToken: required('TWILIO_AUTH_TOKEN'),
  phoneNumber: required('TWILIO_PHONE_NUMBER'),
  validateSignature: process.env.VALIDATE_TWILIO_SIGNATURE !== 'false',
},

supabase: {
  url: required('SUPABASE_URL'),
  serviceKey: required('SUPABASE_SERVICE_KEY'),
},

  admin: {
    phone: process.env.ADMIN_PHONE || null,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;
