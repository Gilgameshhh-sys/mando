# Mando — Plataforma de Comandos Operativos por SMS

> Ejecutá operaciones de negocio por SMS desde cualquier celular.  
> Sin app. Sin internet. Con trazabilidad total.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js 18 + Express |
| SMS Gateway | Twilio (tests) · 360NRS (producción ARG) |
| Base de datos | Supabase (PostgreSQL) |
| Deploy | Railway |
| Logs | Winston + Supabase `audit_logs` |

---

## Estructura del proyecto

```
mando/
├── src/
│   ├── app.js                  # Entry point Express
│   ├── config.js               # Variables de entorno centralizadas
│   ├── commands/
│   │   ├── stock.js            # STOCK [producto]
│   │   ├── venta.js            # VENTA [sku] [cant]
│   │   ├── llegue.js           # LLEGUE [cliente]
│   │   ├── status.js           # STATUS [pedido]
│   │   ├── apruebo.js          # APRUEBO [pedido]
│   │   └── ayuda.js            # AYUDA · CONFIRMAR · CANCELAR
│   ├── middleware/
│   │   ├── auth.js             # Autenticación por número de celular
│   │   └── logger.js           # Winston + auditoría Supabase
│   ├── routes/
│   │   └── webhook.js          # Dispatcher principal de comandos
│   ├── services/
│   │   ├── database.js         # Queries Supabase
│   │   └── sms.js              # Twilio wrapper
│   └── utils/
│       └── parser.js           # Parser de comandos SMS
├── supabase/
│   └── schema.sql              # Schema completo con RLS
├── public/
│   ├── index.html              # Landing page
│   └── admin.html              # Panel de administración
├── .env.example
├── package.json
├── railway.json
└── Procfile
```

---

## Setup local (48 horas al MVP)

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/mando.git
cd mando
npm install
cp .env.example .env
```

### 2. Configurar variables de entorno

Editá `.env` con tus credenciales:

```bash
# Twilio: https://console.twilio.com
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+1415XXXXXXX  # Número de prueba Twilio

# Supabase: https://supabase.com/dashboard
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...

# App
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
VALIDATE_TWILIO_SIGNATURE=false  # false en desarrollo
```

### 3. Inicializar la base de datos

En el SQL Editor de Supabase, ejecutar:

```sql
-- Copiar y ejecutar el contenido de supabase/schema.sql
```

Luego cargar datos de prueba (descomentar las líneas al final del schema).

### 4. Exponer el webhook localmente (para recibir SMS de Twilio)

```bash
# Instalar ngrok: https://ngrok.com
ngrok http 3000

# Copiar la URL HTTPS que genera ngrok, ej:
# https://abc123.ngrok.io
```

En el dashboard de Twilio → Phone Numbers → tu número → Messaging:
- **Webhook URL:** `https://abc123.ngrok.io/webhook/sms`
- **Method:** POST

### 5. Arrancar

```bash
npm run dev
# → 🚀 Mando corriendo en puerto 3000
# → Webhook: http://localhost:3000/webhook/sms
```

### 6. Probar con SMS

Enviá un SMS al número de Twilio:
```
AYUDA          → Lista de comandos
STOCK YERBA    → Consulta stock
VENTA YERBA 5  → Registra venta (pide CONFIRMAR)
```

---

## Deploy a Railway

### 1. Crear proyecto en Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### 2. Variables de entorno en Railway

En el dashboard de Railway → Variables, agregar todas las del `.env`:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `NODE_ENV=production`
- `APP_URL=https://tu-app.up.railway.app`
- `VALIDATE_TWILIO_SIGNATURE=true`

### 3. Actualizar webhook en Twilio

Cambiar la URL del webhook al dominio de Railway:
```
https://tu-app.up.railway.app/webhook/sms
```

### 4. Verificar health check

```bash
curl https://tu-app.up.railway.app/webhook/health
# → {"status":"ok","ts":"...","service":"mando-webhook"}
```

---

## Comandos disponibles

| Comando | Formato | Roles | Confirmación |
|---|---|---|---|
| `STOCK` | `STOCK [producto]` | vendedor, operario, encargado, admin | No |
| `VENTA` | `VENTA [sku] [cant]` | vendedor, encargado, admin | Sí → `CONFIRMAR` |
| `LLEGUE` | `LLEGUE [cliente]` | chofer, encargado, admin | No |
| `STATUS` | `STATUS [pedido]` | Todos | No |
| `APRUEBO` | `APRUEBO [pedido]` | encargado, admin | No (acción inmediata) |
| `AYUDA` | `AYUDA` | Todos | No |

### Flujo de confirmación (VENTA)

```
Usuario → VENTA YERBA 5
Mando  ← "⚡ Yerba Mate 1kg × 5. Stock nuevo: 37. Respondé CONFIRMAR para registrar."
Usuario → CONFIRMAR
Mando  ← "✅ Venta registrada 10:28. Nuevo stock: 37 uds. Auditoría guardada."
```

---

## Roles y permisos

```
admin      → Todos los comandos + gestión de usuarios
encargado  → STOCK · VENTA · LLEGUE · STATUS · APRUEBO · AYUDA
vendedor   → STOCK · VENTA · STATUS · AYUDA
chofer     → LLEGUE · STATUS · AYUDA
operario   → STOCK · STATUS · AYUDA
```

La autenticación es por número de celular (E.164). No hay contraseñas.

---

## Panel de administración

Abrir `public/admin.html` en el browser para acceder al panel de control.

> En producción: servir con Express o deployar en Vercel/Netlify.

Funciones del panel:
- Dashboard con KPIs en tiempo real (comandos/día, tasa de error, tiempo de respuesta)
- Feed de auditoría de comandos con filtros
- Preview de SMS en vivo
- Gestión de usuarios (alta, baja, cambio de rol)
- Inventario con indicadores de stock mínimo
- Tabla de comandos configurados

---

## Escalado post-MVP

### Q2 — Panel no-code
- Configurador de comandos custom sin tocar código
- Integración con Tango / Bejerman (ERPs argentinos)
- Reportes automáticos por email/WhatsApp al encargado

### Q3 — IA como fallback
```javascript
// En webhook.js, si el comando no es reconocido:
if (!isValidCommand(command)) {
  // Llamar a Claude API para interpretar en lenguaje natural
  const interpreted = await interpretWithAI(rawBody, user.role);
  // Redirigir al comando más probable
}
```

### Q4 — Multi-tenant SaaS completo
- Panel de onboarding self-service
- Facturación recurrente (Mercado Pago / Stripe)
- White-label para grandes clientes

---

## Monitoreo

| Herramienta | Para qué | Gratis hasta |
|---|---|---|
| Railway metrics | CPU, RAM, requests | Incluido |
| UptimeRobot | Ping al health check cada 5min | Siempre |
| Supabase logs | Queries lentas, errores de DB | Plan Free |
| Twilio logs | SMS enviados/fallidos, latencia | Incluido |

---

## Costos estimados (MVP)

| Servicio | Costo |
|---|---|
| Railway Starter | USD 5/mes |
| Supabase Free | USD 0/mes |
| Twilio SMS (ARG) | ~ARS 7 por SMS (entrante + saliente) |
| Dominio mando.ar | ~ARS 2.000/año |
| **Total infraestructura** | **~USD 5/mes + SMS** |

---

## Checklist de producción

- [ ] Variables de entorno en Railway
- [ ] Schema SQL ejecutado en Supabase
- [ ] Webhook Twilio apuntando al dominio de Railway
- [ ] `VALIDATE_TWILIO_SIGNATURE=true` en producción
- [ ] UptimeRobot configurado en `/webhook/health`
- [ ] Al menos 1 usuario `admin` cargado en la tabla `users`
- [ ] Al menos 3 productos en la tabla `products`
- [ ] Testar los 6 comandos desde un celular real

---

*Mando · Córdoba, Argentina · mando.ar*  
*Versión 1.0 MVP · Abril 2026*
