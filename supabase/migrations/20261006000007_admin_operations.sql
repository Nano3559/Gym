-- Operación diaria: caja, asistencia, historial financiero, pausas, staff,
-- planes promocionales y configuración global.

create or replace function public.current_gym_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'gym_role',
    case lower(coalesce(auth.jwt() ->> 'email', ''))
      when 'admin@ironforge.com' then 'admin'
      when 'recepcion@ironforge.com' then 'reception'
      else 'member'
    end
  );
$$;

alter table public.profiles add column if not exists foto_url text;
alter table public.plans add column if not exists tipo text not null default 'membresia'
  check (tipo in ('membresia', 'promocion', 'day_pass'));
alter table public.plans add column if not exists fecha_inicio date;
alter table public.plans add column if not exists fecha_fin date;
alter table public.plans add column if not exists cantidad_incluida integer not null default 1
  check (cantidad_incluida > 0);
alter table public.plans add column if not exists caracteristicas jsonb not null default '[]'::jsonb;
alter table public.plans add column if not exists destacado boolean not null default false;
alter table public.memberships add column if not exists congelada_desde timestamptz;
alter table public.memberships add column if not exists congelada_hasta timestamptz;
alter table public.memberships drop constraint if exists memberships_estado_check;
alter table public.memberships add constraint memberships_estado_check
  check (estado in ('activa', 'por_vencer', 'vencida', 'cancelada', 'congelada'));
alter table public.payments drop constraint if exists payments_metodo_pago_check;
alter table public.payments add constraint payments_metodo_pago_check
  check (metodo_pago in ('qr', 'efectivo', 'transferencia', 'tarjeta', 'yape_plin'));
alter table public.payments add column if not exists cashier_id uuid references auth.users (id);

create or replace function public.procesar_pago_exitoso(
  p_transaction_id text,
  p_user_id uuid,
  p_plan_id uuid,
  p_monto numeric,
  p_metodo_pago text
)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duration integer;
  v_membership public.memberships;
  v_existing_payment public.payments;
  v_rows_updated integer;
begin
  if auth.uid() is null or p_user_id is null
     or (auth.uid() <> p_user_id and public.current_gym_role() not in ('admin', 'reception')) then
    raise exception 'No tienes permiso para registrar este pago';
  end if;
  if nullif(trim(p_transaction_id), '') is null or p_monto is null or p_monto < 0 then
    raise exception 'Los datos del pago no son válidos';
  end if;
  if p_metodo_pago is null
     or p_metodo_pago not in ('qr', 'efectivo', 'transferencia', 'tarjeta', 'yape_plin') then
    raise exception 'Método de pago no válido';
  end if;

  select duracion_dias into v_duration
    from public.plans
   where id = p_plan_id;
  if v_duration is null then raise exception 'El plan seleccionado no existe'; end if;

  select * into v_existing_payment
    from public.payments
   where transaction_id = p_transaction_id
   for update;
  if found and v_existing_payment.user_id <> p_user_id then
    raise exception 'La referencia del pago ya está asociada a otro socio';
  end if;
  if found and v_existing_payment.estado_pago = 'completado'
     and v_existing_payment.membership_id is not null then
    select * into v_membership
      from public.memberships
     where id = v_existing_payment.membership_id;
    if found then return v_membership; end if;
  end if;

  insert into public.payments (
    user_id, plan_id, monto, metodo_pago, estado_pago, transaction_id, cashier_id
  )
  values (
    p_user_id, p_plan_id, p_monto, p_metodo_pago, 'completado', p_transaction_id, auth.uid()
  )
  on conflict (transaction_id) do update
    set estado_pago = 'completado',
        plan_id = excluded.plan_id,
        monto = excluded.monto,
        metodo_pago = excluded.metodo_pago,
        cashier_id = excluded.cashier_id
    where payments.user_id = excluded.user_id;
  get diagnostics v_rows_updated = row_count;
  if v_rows_updated = 0 then
    raise exception 'No se pudo asociar el pago al socio';
  end if;

  select * into v_membership
    from public.memberships
   where user_id = p_user_id and estado in ('activa', 'congelada')
   order by fecha_vencimiento desc
   limit 1
   for update;

  if found then
    update public.memberships
       set plan_id = p_plan_id,
           fecha_inicio = case
             when fecha_vencimiento > current_timestamp then fecha_inicio
             else current_timestamp
           end,
           fecha_vencimiento = greatest(fecha_vencimiento, current_timestamp)
             + make_interval(days => v_duration),
           estado = 'activa',
           congelada_desde = null,
           congelada_hasta = null
     where id = v_membership.id
     returning * into v_membership;
  else
    insert into public.memberships (
      user_id, plan_id, fecha_inicio, fecha_vencimiento, estado
    )
    values (
      p_user_id, p_plan_id, current_timestamp,
      current_timestamp + make_interval(days => v_duration), 'activa'
    )
    returning * into v_membership;
  end if;

  update public.payments
     set membership_id = v_membership.id
   where transaction_id = p_transaction_id and user_id = p_user_id;
  update public.profiles set plan_id = p_plan_id where id = p_user_id;
  return v_membership;
end;
$$;
revoke all on function public.procesar_pago_exitoso(text, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.procesar_pago_exitoso(text, uuid, uuid, numeric, text) to authenticated;

create table if not exists public.gym_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  staff_id uuid not null default auth.uid() references auth.users (id),
  fecha timestamptz not null default now(),
  estado text not null check (estado in ('permitido', 'denegado')),
  motivo text,
  created_at timestamptz not null default now()
);
create index if not exists idx_gym_attendance_user_date
  on public.gym_attendance (user_id, fecha desc);

create table if not exists public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references auth.users (id),
  apertura_efectivo numeric(12, 2) not null check (apertura_efectivo >= 0),
  inicio timestamptz not null default now(),
  cierre timestamptz,
  efectivo_esperado numeric(12, 2),
  efectivo_declarado numeric(12, 2),
  diferencia numeric(12, 2),
  observacion text,
  check (
    (cierre is null and efectivo_esperado is null and efectivo_declarado is null and diferencia is null)
    or
    (cierre is not null and efectivo_esperado is not null and efectivo_declarado is not null and diferencia is not null)
  )
);
create unique index if not exists uq_cash_register_open_by_staff
  on public.cash_register_sessions (staff_id) where cierre is null;
create index if not exists idx_cash_register_sessions_start
  on public.cash_register_sessions (inicio desc);

create table if not exists public.staff_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  email text not null unique,
  rol text not null check (rol in ('reception', 'trainer')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gym_settings (
  id boolean primary key default true check (id),
  nombre text not null default 'IronForge Gym',
  telefono text not null default '',
  correo text not null default '',
  direccion text not null default '',
  horario jsonb not null default '{}'::jsonb,
  terminos_legales text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.gym_settings (id) values (true) on conflict (id) do nothing;

alter table public.gym_attendance enable row level security;
alter table public.cash_register_sessions enable row level security;
alter table public.staff_accounts enable row level security;
alter table public.gym_settings enable row level security;

drop policy if exists "Staff ve registros de asistencia" on public.gym_attendance;
create policy "Staff ve registros de asistencia"
  on public.gym_attendance for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception', 'trainer'));
drop policy if exists "Recepción registra asistencia" on public.gym_attendance;
create policy "Recepción registra asistencia"
  on public.gym_attendance for insert to authenticated
  with check (
    staff_id = auth.uid()
    and public.current_gym_role() in ('admin', 'reception', 'trainer')
  );

drop policy if exists "Staff lee cajas" on public.cash_register_sessions;
create policy "Staff lee cajas"
  on public.cash_register_sessions for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception'));
drop policy if exists "Staff abre caja propia" on public.cash_register_sessions;
create policy "Staff abre caja propia"
  on public.cash_register_sessions for insert to authenticated
  with check (
    staff_id = auth.uid()
    and public.current_gym_role() in ('admin', 'reception')
  );
drop policy if exists "Staff cierra caja propia" on public.cash_register_sessions;
create policy "Staff cierra caja propia"
  on public.cash_register_sessions for update to authenticated
  using (
    staff_id = auth.uid()
    and cierre is null
    and public.current_gym_role() in ('admin', 'reception')
  )
  with check (
    staff_id = auth.uid()
    and public.current_gym_role() in ('admin', 'reception')
  );

drop policy if exists "Admin gestiona staff" on public.staff_accounts;
create policy "Admin gestiona staff"
  on public.staff_accounts for all to authenticated
  using (public.current_gym_role() = 'admin')
  with check (public.current_gym_role() = 'admin');
drop policy if exists "Staff lee configuración" on public.gym_settings;
create policy "Staff lee configuración"
  on public.gym_settings for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception', 'trainer'));
drop policy if exists "Admin edita configuración" on public.gym_settings;
create policy "Admin edita configuración"
  on public.gym_settings for update to authenticated
  using (public.current_gym_role() = 'admin')
  with check (public.current_gym_role() = 'admin');

drop policy if exists "Staff puede leer perfiles por rol" on public.profiles;
create policy "Staff puede leer perfiles por rol"
  on public.profiles for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception', 'trainer'));
drop policy if exists "Staff puede leer membresías por rol" on public.memberships;
create policy "Staff puede leer membresías por rol"
  on public.memberships for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception', 'trainer'));

drop policy if exists "Staff consulta historial de pagos" on public.payments;
create policy "Staff consulta historial de pagos"
  on public.payments for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception'));
drop policy if exists "Staff consulta planes administrativos" on public.plans;
create policy "Staff consulta planes administrativos"
  on public.plans for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception'));
drop policy if exists "Admin gestiona planes" on public.plans;
create policy "Admin gestiona planes"
  on public.plans for all to authenticated
  using (public.current_gym_role() = 'admin')
  with check (public.current_gym_role() = 'admin');
drop policy if exists "Staff actualiza perfiles de socios" on public.profiles;
create policy "Staff actualiza perfiles de socios"
  on public.profiles for update to authenticated
  using (public.current_gym_role() in ('admin', 'reception'))
  with check (public.current_gym_role() in ('admin', 'reception'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff lee fotos de socios" on storage.objects;
create policy "Staff lee fotos de socios"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'member-photos'
    and public.current_gym_role() in ('admin', 'reception', 'trainer')
  );
drop policy if exists "Staff gestiona fotos de socios" on storage.objects;
create policy "Staff gestiona fotos de socios"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'member-photos'
    and (
      public.current_gym_role() in ('admin', 'reception')
      or split_part(name, '/', 1) = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'member-photos'
    and (
      public.current_gym_role() in ('admin', 'reception')
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );

drop policy if exists "Staff lee catálogo POS por rol" on public.pos_products;
create policy "Staff lee catálogo POS por rol"
  on public.pos_products for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception'));
drop policy if exists "Admin gestiona catálogo POS por rol" on public.pos_products;
create policy "Admin gestiona catálogo POS por rol"
  on public.pos_products for all to authenticated
  using (public.current_gym_role() = 'admin')
  with check (public.current_gym_role() = 'admin');
drop policy if exists "Staff lee ventas POS por rol" on public.pos_sales;
create policy "Staff lee ventas POS por rol"
  on public.pos_sales for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception'));
drop policy if exists "Staff lee detalle POS por rol" on public.pos_sale_items;
create policy "Staff lee detalle POS por rol"
  on public.pos_sale_items for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception'));
drop policy if exists "Staff lee gastos por rol" on public.operating_expenses;
create policy "Staff lee gastos por rol"
  on public.operating_expenses for select to authenticated
  using (public.current_gym_role() in ('admin', 'reception'));
drop policy if exists "Staff registra gastos por rol" on public.operating_expenses;
create policy "Staff registra gastos por rol"
  on public.operating_expenses for insert to authenticated
  with check (
    auth.uid() = created_by
    and public.current_gym_role() in ('admin', 'reception')
  );

create or replace function public.open_cash_register(p_opening_cash numeric)
returns public.cash_register_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.cash_register_sessions;
begin
  if auth.uid() is null or public.current_gym_role() not in ('admin', 'reception') then
    raise exception 'Solo administración o recepción puede abrir caja';
  end if;
  if p_opening_cash is null or p_opening_cash < 0 then
    raise exception 'El fondo inicial no puede ser negativo';
  end if;
  insert into public.cash_register_sessions (staff_id, apertura_efectivo)
  values (auth.uid(), p_opening_cash)
  returning * into v_session;
  return v_session;
end;
$$;

create or replace function public.close_cash_register(
  p_session_id uuid,
  p_reported_cash numeric,
  p_observation text default null
)
returns public.cash_register_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.cash_register_sessions;
  v_cash_sales numeric(12, 2);
  v_cash_expenses numeric(12, 2);
  v_expected numeric(12, 2);
begin
  select * into v_session
    from public.cash_register_sessions
   where id = p_session_id and staff_id = auth.uid() and cierre is null
   for update;
  if not found then raise exception 'No existe una caja abierta para este usuario'; end if;
  if p_reported_cash is null or p_reported_cash < 0 then
    raise exception 'El efectivo contado no puede ser negativo';
  end if;

  select coalesce(sum(total), 0) into v_cash_sales
    from public.pos_sales
   where cashier_id = auth.uid()
     and metodo_pago = 'efectivo'
     and created_at >= v_session.inicio
     and created_at <= now();
  v_cash_sales := v_cash_sales + (
    select coalesce(sum(monto), 0)
      from public.payments
     where cashier_id = auth.uid()
       and metodo_pago = 'efectivo'
       and estado_pago = 'completado'
       and created_at >= v_session.inicio
       and created_at <= now()
  );
  select coalesce(sum(monto), 0) into v_cash_expenses
    from public.operating_expenses
   where created_by = auth.uid()
     and metodo_pago = 'efectivo'
     and created_at >= v_session.inicio
     and created_at <= now();
  v_expected := v_session.apertura_efectivo + v_cash_sales - v_cash_expenses;

  update public.cash_register_sessions
     set cierre = now(),
         efectivo_esperado = v_expected,
         efectivo_declarado = p_reported_cash,
         diferencia = p_reported_cash - v_expected,
         observacion = nullif(trim(p_observation), '')
   where id = p_session_id
   returning * into v_session;
  return v_session;
end;
$$;

create or replace function public.freeze_membership(
  p_membership_id uuid,
  p_days integer
)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare v_membership public.memberships;
begin
  if public.current_gym_role() not in ('admin', 'reception') then
    raise exception 'No tienes permiso para congelar membresías';
  end if;
  if p_days is null or p_days < 1 or p_days > 90 then raise exception 'El congelamiento debe ser de 1 a 90 días'; end if;
  update public.memberships
     set estado = 'congelada',
         congelada_desde = now(),
         congelada_hasta = now() + make_interval(days => p_days),
         fecha_vencimiento = fecha_vencimiento + make_interval(days => p_days)
   where id = p_membership_id
     and estado = 'activa'
   returning * into v_membership;
  if not found then raise exception 'La membresía no está activa o ya se encuentra congelada'; end if;
  return v_membership;
end;
$$;

revoke all on function public.open_cash_register(numeric) from public, anon;
revoke all on function public.close_cash_register(uuid, numeric, text) from public, anon;
revoke all on function public.freeze_membership(uuid, integer) from public, anon;
grant execute on function public.open_cash_register(numeric) to authenticated;
grant execute on function public.close_cash_register(uuid, numeric, text) to authenticated;
grant execute on function public.freeze_membership(uuid, integer) to authenticated;

create or replace function public.register_pos_sale(
  p_payment_method text,
  p_items jsonb
)
returns public.pos_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.pos_sales;
  v_item jsonb;
  v_product public.pos_products;
  v_quantity integer;
  v_total numeric(12, 2) := 0;
begin
  if auth.uid() is null or public.current_gym_role() not in ('admin', 'reception') then
    raise exception 'Solo recepción o administración puede registrar ventas';
  end if;
  if p_payment_method not in ('qr', 'efectivo', 'transferencia', 'tarjeta', 'yape_plin') then
    raise exception 'Método de pago no válido';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'La venta debe incluir al menos un producto';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe incluir al menos un producto';
  end if;
  if not exists (
    select 1 from public.cash_register_sessions
     where staff_id = auth.uid() and cierre is null
  ) then
    raise exception 'Abre tu caja antes de registrar ventas';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
       or coalesce((v_item ->> 'quantity') !~ '^[0-9]+$', true) then
      raise exception 'La cantidad debe ser un entero positivo';
    end if;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity < 1 then raise exception 'La cantidad debe ser un entero positivo'; end if;
    select * into v_product from public.pos_products
     where id = (v_item ->> 'product_id')::uuid and activo
     for update;
    if not found then raise exception 'Producto inexistente o inactivo'; end if;
    if v_product.stock < v_quantity then
      raise exception 'Stock insuficiente para %', v_product.nombre;
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_items) item
       where item ->> 'product_id' = v_item ->> 'product_id'
       group by item ->> 'product_id'
      having sum((item ->> 'quantity')::integer) > v_product.stock
    ) then
      raise exception 'Stock insuficiente para %', v_product.nombre;
    end if;
    v_total := v_total + v_product.precio * v_quantity;
  end loop;

  insert into public.pos_sales (cashier_id, metodo_pago, total)
  values (auth.uid(), p_payment_method, v_total)
  returning * into v_sale;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    select * into v_product from public.pos_products where id = (v_item ->> 'product_id')::uuid;
    insert into public.pos_sale_items (
      sale_id, product_id, product_name, unit_price, quantity, line_total
    )
    values (
      v_sale.id, v_product.id, v_product.nombre, v_product.precio,
      v_quantity, v_product.precio * v_quantity
    );
    update public.pos_products
       set stock = stock - v_quantity, updated_at = now()
     where id = v_product.id;
  end loop;
  return v_sale;
end;
$$;

revoke all on function public.register_pos_sale(text, jsonb) from public, anon;
grant execute on function public.register_pos_sale(text, jsonb) to authenticated;
