create or replace function public.staff_has_permission(p_permission text)
returns boolean
language sql
stable
as $$
  select
    (auth.jwt() ->> 'email') = 'admin@ironforge.com'
    or (auth.jwt() ->> 'email') = 'recepcion@ironforge.com'
    or coalesce(auth.jwt() -> 'app_metadata' -> 'staff_permissions', '[]'::jsonb) ? p_permission;
$$;

revoke all on function public.staff_has_permission(text) from public;
grant execute on function public.staff_has_permission(text) to authenticated;

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('reception', 'trainer')),
  permissions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;
drop policy if exists "Admin puede listar personal" on public.staff_members;
create policy "Admin puede listar personal"
  on public.staff_members for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ironforge.com');

create table if not exists public.cash_register_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  operator_email text not null,
  opening_cash numeric(10, 2) not null check (opening_cash >= 0),
  opened_at timestamptz not null default now(),
  closing_cash numeric(10, 2),
  expected_cash numeric(10, 2),
  difference numeric(10, 2),
  closed_at timestamptz,
  check ((closed_at is null and closing_cash is null) or closed_at is not null)
);

create unique index if not exists uq_cash_register_open_shift_per_user
  on public.cash_register_shifts (user_id) where closed_at is null;
create index if not exists idx_cash_register_shifts_opened_at
  on public.cash_register_shifts (opened_at desc);

alter table public.cash_register_shifts enable row level security;
drop policy if exists "Personal puede ver turnos propios y admin todos" on public.cash_register_shifts;
create policy "Personal puede ver turnos propios y admin todos"
  on public.cash_register_shifts for select
  to authenticated
  using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'admin@ironforge.com');
drop policy if exists "Personal abre sus turnos" on public.cash_register_shifts;
create policy "Personal abre sus turnos"
  on public.cash_register_shifts for insert
  to authenticated
  with check (auth.uid() = user_id and public.staff_has_permission('cash'));
drop policy if exists "Personal cierra sus turnos" on public.cash_register_shifts;
create policy "Personal cierra sus turnos"
  on public.cash_register_shifts for update
  to authenticated
  using ((auth.uid() = user_id and public.staff_has_permission('cash')) or (auth.jwt() ->> 'email') = 'admin@ironforge.com')
  with check ((auth.uid() = user_id and public.staff_has_permission('cash')) or (auth.jwt() ->> 'email') = 'admin@ironforge.com');

create table if not exists public.cash_register_transactions (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.cash_register_shifts (id),
  user_id uuid not null references auth.users (id),
  transaction_type text not null check (transaction_type in ('sale', 'expense')),
  description text not null,
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('efectivo', 'tarjeta', 'yape_plin', 'qr', 'transferencia')),
  created_at timestamptz not null default now()
);

create index if not exists idx_cash_register_transactions_shift
  on public.cash_register_transactions (shift_id, created_at);
alter table public.cash_register_transactions enable row level security;
drop policy if exists "Personal ve transacciones de sus turnos" on public.cash_register_transactions;
create policy "Personal ve transacciones de sus turnos"
  on public.cash_register_transactions for select
  to authenticated
  using (
    exists (select 1 from public.cash_register_shifts s where s.id = shift_id and s.user_id = auth.uid())
    or (auth.jwt() ->> 'email') = 'admin@ironforge.com'
  );

drop policy if exists "Personal registra gastos en turno propio" on public.cash_register_transactions;
create policy "Personal registra gastos en turno propio"
  on public.cash_register_transactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and transaction_type = 'expense'
    and public.staff_has_permission('cash')
    and exists (
      select 1 from public.cash_register_shifts s
      where s.id = shift_id and s.user_id = auth.uid() and s.closed_at is null
    )
  );

create or replace function public.open_cash_register_shift(p_opening_cash numeric)
returns public.cash_register_shifts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shift public.cash_register_shifts;
begin
  if not public.staff_has_permission('cash') then raise exception 'No autorizado para abrir caja'; end if;
  if p_opening_cash < 0 then raise exception 'El saldo inicial no puede ser negativo'; end if;
  insert into public.cash_register_shifts (user_id, operator_email, opening_cash)
  values (auth.uid(), auth.jwt() ->> 'email', p_opening_cash)
  returning * into v_shift;
  return v_shift;
end;
$$;

create or replace function public.close_cash_register_shift(p_shift_id uuid, p_closing_cash numeric)
returns public.cash_register_shifts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shift public.cash_register_shifts;
  v_expected numeric(10, 2);
begin
  if not public.staff_has_permission('cash') then raise exception 'No autorizado para cerrar caja'; end if;
  select * into v_shift from public.cash_register_shifts
    where id = p_shift_id and closed_at is null for update;
  if not found then raise exception 'No se encontró el turno abierto'; end if;
  if v_shift.user_id <> auth.uid() and (auth.jwt() ->> 'email') <> 'admin@ironforge.com' then
    raise exception 'Solo el titular o el administrador pueden cerrar este turno';
  end if;
  select v_shift.opening_cash + coalesce(sum(
    case when transaction_type = 'sale' then amount else -amount end
  ), 0) into v_expected
  from public.cash_register_transactions
  where shift_id = p_shift_id and payment_method = 'efectivo';
  update public.cash_register_shifts
    set closing_cash = p_closing_cash,
        expected_cash = v_expected,
        difference = p_closing_cash - v_expected,
        closed_at = now()
    where id = p_shift_id
    returning * into v_shift;
  return v_shift;
end;
$$;

drop function if exists public.sell_inventory_products(jsonb);
create or replace function public.sell_inventory_products(
  p_items jsonb,
  p_shift_id uuid,
  p_total numeric,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product public.inventory_products;
  v_product_id uuid;
  v_quantity integer;
  v_description text := '';
  v_transaction_id uuid;
  v_shift public.cash_register_shifts;
begin
  if not public.staff_has_permission('pos') then raise exception 'No autorizado para vender'; end if;
  select * into v_shift from public.cash_register_shifts
    where id = p_shift_id and user_id = auth.uid() and closed_at is null for update;
  if not found then raise exception 'Debe tener un turno de caja abierto para cobrar'; end if;
  if p_total <= 0 or p_payment_method not in ('efectivo', 'tarjeta', 'yape_plin', 'qr', 'transferencia') then
    raise exception 'Importe o medio de pago no válido';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe contener productos';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then raise exception 'Cantidad de producto no válida'; end if;
    select * into v_product from public.inventory_products where id = v_product_id and active for update;
    if not found then raise exception 'Producto no disponible'; end if;
    if v_product.stock < v_quantity then raise exception 'Stock insuficiente para % (disponible: %)', v_product.name, v_product.stock; end if;
    update public.inventory_products set stock = stock - v_quantity, updated_at = now() where id = v_product_id;
    v_description := concat_ws(', ', nullif(v_description, ''), v_quantity::text || ' x ' || v_product.name);
  end loop;

  insert into public.cash_register_transactions (shift_id, user_id, transaction_type, description, amount, payment_method)
  values (p_shift_id, auth.uid(), 'sale', v_description, p_total, p_payment_method)
  returning id into v_transaction_id;
  return v_transaction_id;
end;
$$;

revoke all on function public.open_cash_register_shift(numeric) from public;
revoke all on function public.close_cash_register_shift(uuid, numeric) from public;
revoke all on function public.sell_inventory_products(jsonb, uuid, numeric, text) from public;
grant execute on function public.open_cash_register_shift(numeric) to authenticated;
grant execute on function public.close_cash_register_shift(uuid, numeric) to authenticated;
grant execute on function public.sell_inventory_products(jsonb, uuid, numeric, text) to authenticated;

drop policy if exists "Personal puede ver productos activos" on public.inventory_products;
create policy "Personal puede ver productos activos"
  on public.inventory_products for select
  to authenticated
  using (
    (active and public.staff_has_permission('pos'))
    or (auth.jwt() ->> 'email') = 'admin@ironforge.com'
  );

create or replace function public.record_cash_expense(
  p_shift_id uuid,
  p_description text,
  p_amount numeric,
  p_payment_method text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.staff_has_permission('cash') then raise exception 'No autorizado para registrar gastos de turno'; end if;
  if p_amount <= 0 or p_payment_method not in ('efectivo', 'tarjeta', 'yape_plin', 'qr', 'transferencia') then
    raise exception 'Importe o medio de pago no válido';
  end if;
  if not exists (
    select 1 from public.cash_register_shifts
    where id = p_shift_id and user_id = auth.uid() and closed_at is null
  ) then raise exception 'No hay un turno abierto para este usuario'; end if;
  insert into public.cash_register_transactions (shift_id, user_id, transaction_type, description, amount, payment_method)
  values (p_shift_id, auth.uid(), 'expense', p_description, p_amount, p_payment_method)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_cash_expense(uuid, text, numeric, text) from public;
grant execute on function public.record_cash_expense(uuid, text, numeric, text) to authenticated;

drop policy if exists "Personal puede leer perfiles" on public.profiles;
create policy "Personal puede leer perfiles"
  on public.profiles for select
  to authenticated
  using (public.staff_has_permission('clients') or public.staff_has_permission('attendance'));
drop policy if exists "Personal puede actualizar perfiles" on public.profiles;
create policy "Personal puede actualizar perfiles"
  on public.profiles for update
  to authenticated
  using (public.staff_has_permission('clients'))
  with check (public.staff_has_permission('clients'));

drop policy if exists "Personal puede leer membresias" on public.memberships;
create policy "Personal puede leer membresias"
  on public.memberships for select
  to authenticated
  using (public.staff_has_permission('clients') or public.staff_has_permission('attendance'));
drop policy if exists "Personal puede congelar membresias" on public.memberships;
create policy "Personal puede congelar membresias"
  on public.memberships for update
  to authenticated
  using (public.staff_has_permission('clients'))
  with check (public.staff_has_permission('clients'));

drop policy if exists "Personal puede leer pagos de clientes" on public.payments;
create policy "Personal puede leer pagos de clientes"
  on public.payments for select
  to authenticated
  using (public.staff_has_permission('clients'));

drop policy if exists "Personal puede leer historial de asistencia" on public.asistencia;
create policy "Personal puede leer historial de asistencia"
  on public.asistencia for select
  to authenticated
  using (public.staff_has_permission('attendance'));
drop policy if exists "Personal puede registrar asistencia" on public.asistencia;
create policy "Personal puede registrar asistencia"
  on public.asistencia for insert
  to authenticated
  with check (public.staff_has_permission('attendance'));

create table if not exists public.gym_settings (
  id integer primary key default 1 check (id = 1),
  gym_name text not null default 'IronForge',
  address text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  hours text not null default '',
  legal_terms text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.gym_settings (id, gym_name, address, phone, whatsapp, email, hours, legal_terms)
values (1, 'IronForge', 'Av. Bolívar #245, Zona Central, Santa Cruz', '+591 7 123 4567', '59171234567', 'contacto@ironforgegym.bo', 'Lunes a Viernes 05:30 – 22:00 · Sábado 07:00 – 18:00', 'Al registrarte aceptas los términos del servicio y las políticas de tratamiento de datos del gimnasio.')
on conflict (id) do nothing;

alter table public.gym_settings enable row level security;
drop policy if exists "Configuración pública visible" on public.gym_settings;
create policy "Configuración pública visible"
  on public.gym_settings for select
  using (true);
drop policy if exists "Admin actualiza configuración global" on public.gym_settings;
create policy "Admin actualiza configuración global"
  on public.gym_settings for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ironforge.com')
  with check ((auth.jwt() ->> 'email') = 'admin@ironforge.com');