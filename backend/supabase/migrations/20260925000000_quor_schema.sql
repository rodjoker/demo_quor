-- =====================================================================
-- Demo Quor: pedidos con stock en tiempo real
-- Reglas de oro:
--   1. El stock SOLO cambia mediante funciones (place_order, set_order_status,
--      adjust_stock). Ningun cliente tiene UPDATE/INSERT directo.
--   2. stock.quantity tiene CHECK (>= 0): la base impide el stock negativo
--      aunque el codigo de la app tenga un bug.
--   3. Todo cambio de stock deja un renglon en stock_movements (auditoria).
-- =====================================================================

-- ---------- Tipos ----------
create type public.app_role as enum ('admin', 'vendedor', 'bodega', 'cliente');

create type public.app_permission as enum (
  'VIEW_STOCK',
  'MANAGE_STOCK',
  'MANAGE_PRODUCTS',
  'CREATE_ORDER',
  'CREATE_ORDER_FOR_OTHERS',
  'VIEW_ALL_ORDERS',
  'VIEW_OWN_ORDERS',
  'UPDATE_ORDER_STATUS',
  'PREPARE_ORDERS',
  'VIEW_ALL_CUSTOMERS',
  'VIEW_DASHBOARD',
  'VIEW_UNMET_DEMAND',
  'VIEW_STOCK_MOVEMENTS',
  'MANAGE_USERS'
);

create type public.order_status as enum
  ('recibido', 'en_revision', 'aprobado', 'preparando', 'despachado', 'cancelado');
create type public.order_channel as enum ('web', 'app');
create type public.customer_type as enum ('mayorista', 'detal');
create type public.stock_movement_reason as enum
  ('sale', 'cancel_restock', 'manual_adjust', 'sync');

-- ---------- Usuarios ----------
create table public.profiles (
  id              uuid references auth.users on delete cascade not null primary key,
  updated_at      timestamp with time zone,
  username        text,
  full_name       text,
  address         text,
  phone_number    text,
  email           text unique not null,
  -- El registro publico SIEMPRE crea 'cliente'. Los demas roles los asigna un admin.
  role            public.app_role not null default 'cliente',
  blocked         boolean not null default false,
  failed_attempts integer not null default 0
);

create table public.role_permissions (
  id         bigserial primary key,
  role       public.app_role not null,
  permission public.app_permission not null,
  unique (role, permission)
);

-- ---------- Negocio ----------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid unique references public.profiles(id) on delete set null,
  name          text not null,
  document      text,                       -- NIT o cedula
  city          text,
  phone         text,
  email         text,
  customer_type public.customer_type not null default 'detal',
  created_at    timestamp with time zone not null default now()
);

create table public.warehouses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  city       text,
  is_default boolean not null default false,
  created_at timestamp with time zone not null default now()
);
-- Como maximo UNA bodega por defecto
create unique index one_default_warehouse on public.warehouses (is_default) where is_default;

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  sku         text unique not null,
  name        text not null,
  category    text not null,                -- slug: gel-polish, tradicional, ...
  description text,
  price_cop   integer not null check (price_cop >= 0),
  image_url   text,
  source_url  text,
  active      boolean not null default true,
  created_at  timestamp with time zone not null default now()
);
create index products_category_idx on public.products (category) where active;

create table public.stock (
  product_id   uuid not null references public.products(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  quantity     integer not null default 0 check (quantity >= 0),
  updated_at   timestamp with time zone not null default now(),
  primary key (product_id, warehouse_id)
);

create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  customer_id  uuid not null references public.customers(id),
  warehouse_id uuid not null references public.warehouses(id),
  channel      public.order_channel not null default 'web',
  status       public.order_status not null default 'recibido',
  total_cop    integer not null default 0 check (total_cop >= 0),
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamp with time zone not null default now(),
  updated_at   timestamp with time zone not null default now()
);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_customer_idx on public.orders (customer_id);

create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  product_id         uuid not null references public.products(id),
  quantity_requested integer not null check (quantity_requested > 0),
  quantity_confirmed integer not null check (quantity_confirmed >= 0),
  unit_price_cop     integer not null check (unit_price_cop >= 0),
  unique (order_id, product_id),
  check (quantity_confirmed <= quantity_requested)
);

-- Demanda que Quor hoy pierde sin enterarse
create table public.unmet_demand (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  product_id       uuid not null references public.products(id),
  quantity_missing integer not null check (quantity_missing > 0),
  unit_price_cop   integer not null check (unit_price_cop >= 0),
  created_at       timestamp with time zone not null default now()
);
create index unmet_demand_product_idx on public.unmet_demand (product_id, created_at desc);

-- Libro de movimientos: auditoria y base del dashboard de rotacion
create table public.stock_movements (
  id           bigserial primary key,
  product_id   uuid not null references public.products(id),
  warehouse_id uuid not null references public.warehouses(id),
  delta        integer not null check (delta <> 0),
  reason       public.stock_movement_reason not null,
  order_id     uuid references public.orders(id) on delete set null,
  user_id      uuid references auth.users(id) on delete set null,
  note         text,
  created_at   timestamp with time zone not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

-- Historial de estados del pedido: quien lo cambio y por que
create table public.order_events (
  id          bigserial primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  user_id     uuid references auth.users(id) on delete set null,
  reason      text,
  created_at  timestamp with time zone not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- ---------- Permisos por rol ----------
insert into public.role_permissions (role, permission) values
  ('admin', 'VIEW_STOCK'), ('admin', 'MANAGE_STOCK'), ('admin', 'MANAGE_PRODUCTS'),
  ('admin', 'CREATE_ORDER'), ('admin', 'CREATE_ORDER_FOR_OTHERS'),
  ('admin', 'VIEW_ALL_ORDERS'), ('admin', 'VIEW_OWN_ORDERS'),
  ('admin', 'UPDATE_ORDER_STATUS'), ('admin', 'PREPARE_ORDERS'),
  ('admin', 'VIEW_ALL_CUSTOMERS'), ('admin', 'VIEW_DASHBOARD'),
  ('admin', 'VIEW_UNMET_DEMAND'), ('admin', 'VIEW_STOCK_MOVEMENTS'), ('admin', 'MANAGE_USERS'),
  -- vendedor: crea pedidos para clientes y los gestiona; el stock es de solo lectura
  ('vendedor', 'VIEW_STOCK'), ('vendedor', 'CREATE_ORDER'), ('vendedor', 'CREATE_ORDER_FOR_OTHERS'),
  ('vendedor', 'VIEW_ALL_ORDERS'), ('vendedor', 'UPDATE_ORDER_STATUS'), ('vendedor', 'VIEW_ALL_CUSTOMERS'),
  -- bodega: ve la cola de pedidos y solo puede pasarlos a preparando/despachado
  ('bodega', 'VIEW_STOCK'), ('bodega', 'VIEW_ALL_ORDERS'), ('bodega', 'PREPARE_ORDERS'),
  ('bodega', 'VIEW_ALL_CUSTOMERS'),
  -- cliente: compra y ve solo lo suyo
  ('cliente', 'VIEW_STOCK'), ('cliente', 'CREATE_ORDER'), ('cliente', 'VIEW_OWN_ORDERS');

insert into public.warehouses (name, city, is_default) values ('Bodega principal', 'Medellin', true);

-- ---------- Funciones de apoyo ----------
-- ¿El usuario logueado (y no bloqueado) tiene este permiso?
create or replace function public.has_permission(p public.app_permission)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.role_permissions rp on rp.role = pr.role
    where pr.id = (select auth.uid())
      and not pr.blocked
      and rp.permission = p
  );
$$;

-- Al registrarse: perfil (rol cliente) + ficha de cliente
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.customers (profile_id, name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- COMPRA: descuenta el stock al instante y de forma atomica ----------
-- p_items: [{"product_id": "<uuid>", "quantity": 50}, ...]
-- p_on_shortage: 'partial' = lleva lo disponible y registra la demanda no atendida
--                'reject'  = si falta stock, aborta TODO el pedido
create or replace function public.place_order(
  p_customer_id  uuid,
  p_items        jsonb,
  p_channel      public.order_channel default 'web',
  p_on_shortage  text default 'partial',
  p_warehouse_id uuid default null,
  p_notes        text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());   -- null cuando llama el servidor (service_role)
  v_wh        uuid;
  v_order_id  uuid;
  v_number    bigint;
  v_line      record;
  v_price     integer;
  v_avail     integer;
  v_take      integer;
  v_total     integer := 0;
  v_units     integer := 0;
  v_lines     jsonb := '[]'::jsonb;
  v_status    public.order_status := 'recibido';
begin
  if p_on_shortage not in ('partial', 'reject') then
    raise exception 'invalid_shortage_mode' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
    where x.product_id is null or x.quantity is null or x.quantity <= 0 or x.quantity > 100000
  ) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  -- Un usuario logueado: necesita permiso, y solo un vendedor/admin compra a nombre de otros
  if v_uid is not null then
    if not public.has_permission('CREATE_ORDER') then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if not public.has_permission('CREATE_ORDER_FOR_OTHERS') and not exists (
      select 1 from public.customers c where c.id = p_customer_id and c.profile_id = v_uid
    ) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;

  if p_warehouse_id is null then
    select id into v_wh from public.warehouses where is_default;
  else
    select id into v_wh from public.warehouses where id = p_warehouse_id;
  end if;
  if v_wh is null then
    raise exception 'warehouse_not_found' using errcode = 'P0002';
  end if;

  insert into public.orders (customer_id, warehouse_id, channel, notes, created_by)
  values (p_customer_id, v_wh, p_channel, p_notes, v_uid)
  returning id, order_number into v_order_id, v_number;

  -- Se agrupan lineas repetidas y se recorre por product_id: el orden fijo de bloqueo
  -- evita deadlocks entre pedidos simultaneos.
  for v_line in
    select x.product_id, sum(x.quantity)::int as qty
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
    group by x.product_id
    order by x.product_id
  loop
    select p.price_cop into v_price
    from public.products p where p.id = v_line.product_id and p.active;
    if not found then
      raise exception 'product_not_found: %', v_line.product_id using errcode = 'P0002';
    end if;

    -- FOR UPDATE: nadie mas toca esta fila hasta que termine la transaccion
    select s.quantity into v_avail
    from public.stock s
    where s.product_id = v_line.product_id and s.warehouse_id = v_wh
    for update;
    if not found then v_avail := 0; end if;

    if p_on_shortage = 'reject' and v_avail < v_line.qty then
      raise exception 'insufficient_stock: product %, requested %, available %',
        v_line.product_id, v_line.qty, v_avail using errcode = 'P0001';
    end if;

    v_take := least(v_avail, v_line.qty);

    if v_take > 0 then
      update public.stock
         set quantity = quantity - v_take, updated_at = now()
       where product_id = v_line.product_id and warehouse_id = v_wh;
      insert into public.stock_movements (product_id, warehouse_id, delta, reason, order_id, user_id)
      values (v_line.product_id, v_wh, -v_take, 'sale', v_order_id, v_uid);
    end if;

    insert into public.order_items
      (order_id, product_id, quantity_requested, quantity_confirmed, unit_price_cop)
    values (v_order_id, v_line.product_id, v_line.qty, v_take, v_price);

    if v_line.qty > v_take then
      insert into public.unmet_demand (order_id, product_id, quantity_missing, unit_price_cop)
      values (v_order_id, v_line.product_id, v_line.qty - v_take, v_price);
    end if;

    v_total := v_total + v_take * v_price;
    v_units := v_units + v_take;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_line.product_id,
      'requested', v_line.qty,
      'confirmed', v_take,
      'missing', v_line.qty - v_take
    );
  end loop;

  -- Sin una sola unidad disponible no hay nada que preparar: el pedido queda cancelado
  -- (la demanda no atendida ya quedo registrada) y no ensucia la cola de la bodega.
  if v_units = 0 then v_status := 'cancelado'; end if;

  update public.orders set total_cop = v_total, status = v_status where id = v_order_id;

  insert into public.order_events (order_id, from_status, to_status, user_id, reason)
  values (v_order_id, null, 'recibido', v_uid, null);
  if v_status = 'cancelado' then
    insert into public.order_events (order_id, from_status, to_status, user_id, reason)
    values (v_order_id, 'recibido', 'cancelado', v_uid, 'sin_stock');
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_number,
    'status', v_status,
    'total_cop', v_total,
    'lines', v_lines
  );
end;
$$;

-- ---------- CAMBIO DE ESTADO (cancelar devuelve el stock) ----------
create or replace function public.set_order_status(
  p_order_id   uuid,
  p_new_status public.order_status,
  p_reason     text default null
) returns public.order_status
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_old     public.order_status;
  v_wh      uuid;
  v_valid   boolean;
  v_item    record;
begin
  select o.status, o.warehouse_id into v_old, v_wh
  from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  v_valid := case v_old
    when 'recibido'    then p_new_status in ('en_revision', 'preparando', 'cancelado')
    when 'en_revision' then p_new_status in ('aprobado', 'cancelado')
    when 'aprobado'    then p_new_status in ('preparando', 'cancelado')
    when 'preparando'  then p_new_status in ('despachado', 'cancelado')
    else false
  end;
  if not v_valid then
    raise exception 'invalid_transition: % -> %', v_old, p_new_status using errcode = '22023';
  end if;

  -- vendedor/admin pueden todo; la bodega solo preparar y despachar
  if v_uid is not null and not (
    public.has_permission('UPDATE_ORDER_STATUS')
    or (p_new_status in ('preparando', 'despachado') and public.has_permission('PREPARE_ORDERS'))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_new_status = 'cancelado' then
    for v_item in
      select oi.product_id, oi.quantity_confirmed as qty
      from public.order_items oi
      where oi.order_id = p_order_id and oi.quantity_confirmed > 0
      order by oi.product_id
    loop
      insert into public.stock (product_id, warehouse_id, quantity)
      values (v_item.product_id, v_wh, v_item.qty)
      on conflict (product_id, warehouse_id)
      do update set quantity = public.stock.quantity + excluded.quantity, updated_at = now();

      insert into public.stock_movements (product_id, warehouse_id, delta, reason, order_id, user_id)
      values (v_item.product_id, v_wh, v_item.qty, 'cancel_restock', p_order_id, v_uid);
    end loop;
  end if;

  update public.orders set status = p_new_status, updated_at = now() where id = p_order_id;

  insert into public.order_events (order_id, from_status, to_status, user_id, reason)
  values (p_order_id, v_old, p_new_status, v_uid, p_reason);

  return p_new_status;
end;
$$;

-- ---------- AJUSTE MANUAL DE STOCK (solo admin), con auditoria ----------
create or replace function public.adjust_stock(
  p_product_id   uuid,
  p_new_quantity integer,
  p_reason       text default null,
  p_warehouse_id uuid default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_wh  uuid;
  v_old integer;
begin
  if v_uid is not null and not public.has_permission('MANAGE_STOCK') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if p_warehouse_id is null then
    select id into v_wh from public.warehouses where is_default;
  else
    select id into v_wh from public.warehouses where id = p_warehouse_id;
  end if;
  if v_wh is null then
    raise exception 'warehouse_not_found' using errcode = 'P0002';
  end if;

  insert into public.stock (product_id, warehouse_id, quantity)
  values (p_product_id, v_wh, 0)
  on conflict (product_id, warehouse_id) do nothing;

  select quantity into v_old
  from public.stock where product_id = p_product_id and warehouse_id = v_wh for update;

  if p_new_quantity <> v_old then
    update public.stock set quantity = p_new_quantity, updated_at = now()
     where product_id = p_product_id and warehouse_id = v_wh;
    insert into public.stock_movements (product_id, warehouse_id, delta, reason, user_id, note)
    values (p_product_id, v_wh, p_new_quantity - v_old, 'manual_adjust', v_uid, p_reason);
  end if;

  return p_new_quantity;
end;
$$;

-- Quien puede ejecutar cada funcion (el servidor con service_role siempre puede)
revoke execute on function public.has_permission(public.app_permission) from public, anon;
revoke execute on function public.place_order(uuid, jsonb, public.order_channel, text, uuid, text) from public, anon;
revoke execute on function public.set_order_status(uuid, public.order_status, text) from public, anon;
revoke execute on function public.adjust_stock(uuid, integer, text, uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.has_permission(public.app_permission) to authenticated;
grant execute on function public.place_order(uuid, jsonb, public.order_channel, text, uuid, text) to authenticated;
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.adjust_stock(uuid, integer, text, uuid) to authenticated;

-- ---------- RLS ----------
alter table public.profiles         enable row level security;
alter table public.role_permissions enable row level security;
alter table public.customers        enable row level security;
alter table public.warehouses       enable row level security;
alter table public.products         enable row level security;
alter table public.stock            enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.unmet_demand     enable row level security;
alter table public.stock_movements  enable row level security;
alter table public.order_events     enable row level security;

-- (select ...) evalua una sola vez por consulta, no por fila
create policy "profiles: propio o admin" on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select public.has_permission('MANAGE_USERS')));
create policy "profiles: editar el propio" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "permisos legibles" on public.role_permissions for select to authenticated using (true);

create policy "customers: propio o con permiso" on public.customers for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.has_permission('VIEW_ALL_CUSTOMERS')));

create policy "warehouses: legibles" on public.warehouses for select to authenticated using (true);

-- Catalogo publico (el formulario de la web lo muestra sin login)
create policy "products: catalogo publico" on public.products for select to anon, authenticated
  using (active);

create policy "stock: con permiso" on public.stock for select to authenticated
  using ((select public.has_permission('VIEW_STOCK')));

create policy "orders: propios o con permiso" on public.orders for select to authenticated
  using (
    (select public.has_permission('VIEW_ALL_ORDERS'))
    or customer_id in (select c.id from public.customers c where c.profile_id = (select auth.uid()))
  );
create policy "order_items: segun el pedido" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy "order_events: segun el pedido" on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy "demanda no atendida: con permiso" on public.unmet_demand for select to authenticated
  using ((select public.has_permission('VIEW_UNMET_DEMAND')));
create policy "movimientos: con permiso" on public.stock_movements for select to authenticated
  using ((select public.has_permission('VIEW_STOCK_MOVEMENTS')));

-- ---------- Permisos de tabla (Data API) ----------
-- Solo LECTURA. Toda escritura pasa por las funciones de arriba o por el servidor.
-- Supabase concede ALL por defecto en tablas nuevas: se retira para no depender solo de RLS.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.role_permissions, public.customers, public.warehouses,
  public.stock, public.orders, public.order_items, public.order_events,
  public.unmet_demand, public.stock_movements to authenticated;
grant select on public.products to anon, authenticated;

-- El usuario solo edita sus datos personales. Sin este limite por columna podria hacerse
-- admin a si mismo (role) o desbloquearse (blocked, failed_attempts).
revoke update on public.profiles from authenticated;
grant update (username, full_name, address, phone_number, updated_at)
  on public.profiles to authenticated;

-- ---------- Tiempo real (RLS se respeta: cada quien recibe solo lo que puede ver) ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.stock, public.orders;
  end if;
end;
$$;
