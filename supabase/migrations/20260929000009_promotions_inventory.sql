alter table public.plans
  add column if not exists plan_type text not null default 'standard',
  add column if not exists starts_at date,
  add column if not exists ends_at date;

alter table public.plans
  drop constraint if exists plans_plan_type_check;

alter table public.plans
  add constraint plans_plan_type_check
  check (plan_type in ('standard', 'promotion', 'day_pass'));

drop policy if exists "Admin puede leer todos los planes" on public.plans;
create policy "Admin puede leer todos los planes"
  on public.plans for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ironforge.com');

drop policy if exists "Admin puede crear planes" on public.plans;
create policy "Admin puede crear planes"
  on public.plans for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'admin@ironforge.com');

drop policy if exists "Admin puede actualizar planes" on public.plans;
create policy "Admin puede actualizar planes"
  on public.plans for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ironforge.com')
  with check ((auth.jwt() ->> 'email') = 'admin@ironforge.com');

drop policy if exists "Admin puede borrar planes" on public.plans;
create policy "Admin puede borrar planes"
  on public.plans for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ironforge.com');

create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  cost_price numeric(10, 2) not null check (cost_price >= 0),
  sale_price numeric(10, 2) not null check (sale_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_products_active_name
  on public.inventory_products (active, name);

alter table public.inventory_products enable row level security;

drop policy if exists "Personal puede ver productos activos" on public.inventory_products;
create policy "Personal puede ver productos activos"
  on public.inventory_products for select
  to authenticated
  using (
    active
    or (auth.jwt() ->> 'email') = 'admin@ironforge.com'
  );

drop policy if exists "Admin administra inventario" on public.inventory_products;
create policy "Admin administra inventario"
  on public.inventory_products for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ironforge.com')
  with check ((auth.jwt() ->> 'email') = 'admin@ironforge.com');

create or replace function public.sell_inventory_products(p_items jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product public.inventory_products;
  v_product_id uuid;
  v_quantity integer;
begin
  if coalesce(auth.jwt() ->> 'email', '') not in ('recepcion@ironforge.com', 'admin@ironforge.com') then
    raise exception 'No autorizado para registrar ventas';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe contener productos';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor que cero';
    end if;

    select * into v_product
      from public.inventory_products
      where id = v_product_id and active
      for update;
    if not found then
      raise exception 'Producto no disponible';
    end if;
    if v_product.stock < v_quantity then
      raise exception 'Stock insuficiente para % (disponible: %)', v_product.name, v_product.stock;
    end if;
    update public.inventory_products
      set stock = stock - v_quantity, updated_at = now()
      where id = v_product_id;
  end loop;
  return true;
end;
$$;

revoke all on function public.sell_inventory_products(jsonb) from public;
revoke all on function public.sell_inventory_products(jsonb) from anon;
grant execute on function public.sell_inventory_products(jsonb) to authenticated;