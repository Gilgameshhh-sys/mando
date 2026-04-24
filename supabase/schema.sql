-- ══════════════════════════════════════════════════════════════
-- MANDO — Schema completo de base de datos
-- Supabase/PostgreSQL
-- Versión: 1.0 MVP
-- ══════════════════════════════════════════════════════════════

-- ── Extensiones ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Roles de usuario ──────────────────────────────────────────
create type user_role as enum ('admin', 'encargado', 'vendedor', 'chofer', 'operario');

-- ── Clientes (empresas que contratan Mando) ───────────────────
create table clients (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  plan        text not null default 'starter', -- starter | growth | pro
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Usuarios finales (empleados de los clientes) ──────────────
create table users (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,
  phone       text not null unique, -- E.164, ej: +549351XXXXXXX
  role        user_role not null default 'vendedor',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index users_phone_idx on users(phone);
create index users_client_idx on users(client_id);

-- ── Productos / inventario ────────────────────────────────────
create table products (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,
  sku         text not null,
  aliases     text[] default '{}', -- Nombres alternativos para búsqueda por SMS
  stock_qty   integer not null default 0 check (stock_qty >= 0),
  min_stock   integer not null default 0,
  unit        text not null default 'uds', -- uds | kg | lt | cajas
  location    text, -- Ej: "Depósito Central", "Estante B3"
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(client_id, sku)
);

create index products_client_idx on products(client_id);
create index products_sku_idx on products(client_id, sku);

-- ── Clientes finales (destinatarios de pedidos) ───────────────
create table delivery_clients (
  id               uuid primary key default uuid_generate_v4(),
  client_id        uuid not null references clients(id) on delete cascade, -- tenant
  name             text not null,
  code             text not null, -- Código corto para SMS: "CLIENTE23"
  address          text,
  contact_phone    text,
  current_order_id uuid, -- FK circular, se setea después
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique(client_id, code)
);

-- ── Órdenes / pedidos ─────────────────────────────────────────
create type order_status as enum ('pending', 'in_transit', 'arrived', 'approved', 'delivered', 'cancelled', 'issue');

create table orders (
  id              text primary key, -- Número de orden legible, ej: "1942"
  client_id       uuid not null references clients(id),  -- tenant
  delivery_client uuid references delivery_clients(id),
  driver_id       uuid references users(id),
  status          order_status not null default 'pending',
  items_summary   text, -- Resumen para SMS: "12 cajas, 3 pallets"
  approved_by     uuid references users(id),
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index orders_client_idx on orders(client_id);
create index orders_status_idx on orders(status);

-- FK circular: delivery_clients → orders
alter table delivery_clients
  add constraint delivery_clients_current_order_fk
  foreign key (current_order_id) references orders(id);

-- ── Eventos de entrega (timeline) ────────────────────────────
create table delivery_events (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references clients(id),
  order_id    text references orders(id),
  delivery_client_id uuid references delivery_clients(id),
  user_id     uuid references users(id),
  phone       text not null,
  event_type  text not null, -- arrived | delivered | issue | cancelled
  notes       text,
  created_at  timestamptz not null default now()
);

-- ── Operaciones pendientes de confirmación ────────────────────
create table pending_ops (
  user_id     uuid primary key references users(id) on delete cascade,
  data        jsonb not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- ── Auditoría de comandos ─────────────────────────────────────
create table audit_logs (
  id          bigint primary key generated always as identity,
  phone       text not null,
  user_id     uuid references users(id),
  raw_command text,
  args        text,
  result      text,
  success     boolean not null default true,
  error_msg   text,
  created_at  timestamptz not null default now()
);

create index audit_logs_phone_idx on audit_logs(phone);
create index audit_logs_user_idx on audit_logs(user_id);
create index audit_logs_created_idx on audit_logs(created_at desc);

-- ══════════════════════════════════════════════════════════════
-- FUNCIÓN: decrement_stock (atómica con lock)
-- Evita condiciones de carrera en descuentos concurrentes.
-- ══════════════════════════════════════════════════════════════
create or replace function decrement_stock(
  p_product_id  uuid,
  p_qty         integer,
  p_user_id     uuid,
  p_phone       text
)
returns jsonb
language plpgsql
as $$
declare
  v_product     products%rowtype;
  v_new_stock   integer;
begin
  -- Lock exclusivo sobre la fila del producto
  select * into v_product
  from products
  where id = p_product_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'product_not_found');
  end if;

  if v_product.stock_qty < p_qty then
    return jsonb_build_object(
      'success', false,
      'reason', 'insufficient_stock',
      'available', v_product.stock_qty
    );
  end if;

  v_new_stock := v_product.stock_qty - p_qty;

  update products
  set stock_qty = v_new_stock, updated_at = now()
  where id = p_product_id;

  -- Registrar movimiento
  insert into stock_movements (product_id, qty_change, new_stock, user_id, phone, reason)
  values (p_product_id, -p_qty, v_new_stock, p_user_id, p_phone, 'VENTA_SMS');

  return jsonb_build_object(
    'success', true,
    'new_stock', v_new_stock,
    'product_name', v_product.name
  );
end;
$$;

-- ── Movimientos de stock ──────────────────────────────────────
create table stock_movements (
  id          bigint primary key generated always as identity,
  product_id  uuid not null references products(id),
  qty_change  integer not null, -- negativo = descuento, positivo = ingreso
  new_stock   integer not null,
  user_id     uuid references users(id),
  phone       text,
  reason      text not null default 'VENTA_SMS', -- VENTA_SMS | AJUSTE | INGRESO | DEVOLUCION
  notes       text,
  created_at  timestamptz not null default now()
);

create index stock_movements_product_idx on stock_movements(product_id);

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Multi-tenant isolation
-- Cada tenant solo ve sus propios datos.
-- ══════════════════════════════════════════════════════════════

alter table products enable row level security;
alter table users enable row level security;
alter table orders enable row level security;
alter table delivery_clients enable row level security;
alter table delivery_events enable row level security;
alter table stock_movements enable row level security;

-- Nota: audit_logs y pending_ops no tienen RLS porque el backend
-- usa service_key que bypasea RLS. Solo se accede desde el server.

-- ══════════════════════════════════════════════════════════════
-- DATOS DE EJEMPLO (opcional — para desarrollo)
-- ══════════════════════════════════════════════════════════════

-- insert into clients (id, name, plan) values
--   ('11111111-1111-1111-1111-111111111111', 'Distribuidora Ejemplo SA', 'growth');

-- insert into users (client_id, name, phone, role) values
--   ('11111111-1111-1111-1111-111111111111', 'Juan Vendedor', '+5493511111111', 'vendedor'),
--   ('11111111-1111-1111-1111-111111111111', 'Ramiro Chofer',  '+5493522222222', 'chofer'),
--   ('11111111-1111-1111-1111-111111111111', 'Admin',          '+5493500000000', 'admin');

-- insert into products (client_id, name, sku, aliases, stock_qty, min_stock, unit) values
--   ('11111111-1111-1111-1111-111111111111', 'Yerba Mate 1kg', 'YERBA-1KG', '{"yerba","mate"}', 42, 15, 'uds'),
--   ('11111111-1111-1111-1111-111111111111', 'Azúcar 1kg',     'AZUCAR-1KG', '{"azucar","azúcar"}', 80, 20, 'uds');
