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
    accountSid: required('ACb6ff975da9f9b9c2358a1c47b8a6c4c3'),
    authToken: required('cabe6676af91c6eec06c2af36ed7b48b'),
    phoneNumber: required('+12292182031'),
    validateSignature: process.env.VALIDATE_TWILIO_SIGNATURE !== 'false',
  },

  supabase: {
    url: required('https://fbzhqleztfyjmelhqxnu.supabase.co'),
    serviceKey: required('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiemhxbGV6dGZ5am1lbGhxeG51Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzA1OTI4MCwiZXhwIjoyMDkyNjM1MjgwfQ.nnUsnYiS_faBM6IcohgfJZtGxk2aE7RHdkDUxxQ_A68'),
  },

  admin: {
    phone: process.env.ADMIN_PHONE || null,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;
