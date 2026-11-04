-- ============================================================================
-- Módulo 5 — Pasarela de Pagos y Membresías
--
-- * Tabla `memberships`: membresías activas/caducadas de cada usuario.
-- * Tabla `payments`: registro de pagos (QR / efectivo / transferencia / tarjeta).
-- * RPC `procesar_pago_exitoso(...)`: confirma el pago, calcula el vencimiento
--   según `plans.duracion_dias` y actualiza la membresía y el plan del perfil.
-- * Publicación Realtime de `memberships` y `payments`.
--
-- Ejecutar en el SQL Editor de Supabase tras la migración 20260820000004.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- memberships: membresías por usuario.
-- ---------------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  fecha_inicio timestamptz not null default now(),
  fecha_vencimiento timestamptz not null,
  estado text not null default 'activa' check (estado in ('activa', 'por_vencer', 'vencida', 'cancelada')),
  created_at timestamptz not null default now()
);

create index if not exists idx_memberships_user on public.memberships (user_id);

-- Solo una membresía activa por usuario (permite conservar el historial previo).
create unique index if not exists uq_memberships_activa_por_usuario
  on public.memberships (user_id)
  where estado = 'activa';

-- ---------------------------------------------------------------------------
-- payments: pagos registrados.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  membership_id uuid references public.memberships (id) on delete set null,
  monto numeric(10, 2) not null check (monto >= 0),
  metodo_pago text not null check (metodo_pago in ('qr', 'efectivo', 'transferencia', 'tarjeta')),
  estado_pago text not null default 'pendiente' check (estado_pago in ('pendiente', 'completado', 'fallido', 'expirado')),
  transaction_id text unique not null,
  qr_code_payload text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_user on public.payments (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.memberships enable row level security;
alter table public.payments enable row level security;

-- memberships: el usuario solo lee sus propias membresías.
drop policy if exists "Leer membresías propias" on public.memberships;
create policy "Leer membresías propias"
  on public.memberships for select
  to authenticated
  using (auth.uid() = user_id);

-- payments: el usuario lee sus propios pagos.
drop policy if exists "Leer pagos propios" on public.payments;
create policy "Leer pagos propios"
  on public.payments for select
  to authenticated
  using (auth.uid() = user_id);

-- payments: el usuario puede crear sus propios pagos (registros pendientes).
drop policy if exists "Crear pagos propios" on public.payments;
create policy "Crear pagos propios"
  on public.payments for insert
  to authenticated
  with check (auth.uid() = user_id);

-- La actualización de `payments` y la escritura de `memberships` la realiza la
-- RPC `procesar_pago_exitoso` (security definer), por lo que no se necesitan
-- policies de UPDATE/INSERT adicionales en estas tablas.

-- ---------------------------------------------------------------------------
-- RPC: procesar_pago_exitoso
-- Confirma el pago y registra/renueva la membresía de forma atómica.
-- ---------------------------------------------------------------------------
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
  v_duracion integer;
  v_fecha_vencimiento timestamptz;
  v_membership public.memberships;
begin
  -- Verifica que el plan exista y obtiene su duración en días.
  select duracion_dias
    into v_duracion
    from public.plans
   where id = p_plan_id;

  if v_duracion is null then
    raise exception 'El plan seleccionado no existe';
  end if;

  -- Marca el pago como completado (upsert por transaction_id).
  insert into public.payments (
    user_id, plan_id, monto, metodo_pago, estado_pago, transaction_id
  )
  values (
    p_user_id, p_plan_id, p_monto, p_metodo_pago, 'completado', p_transaction_id
  )
  on conflict (transaction_id) do update
    set estado_pago = 'completado',
        user_id     = excluded.user_id,
        plan_id     = excluded.plan_id,
        monto       = excluded.monto,
        metodo_pago = excluded.metodo_pago;

  -- Calcula el vencimiento de la membresía.
  v_fecha_vencimiento := current_timestamp + (v_duracion || ' days')::interval;

  -- Crea o renueva la membresía activa del usuario para ese plan.
  insert into public.memberships (
    user_id, plan_id, fecha_inicio, fecha_vencimiento, estado
  )
  values (
    p_user_id, p_plan_id, current_timestamp, v_fecha_vencimiento, 'activa'
  )
  on conflict (user_id) where estado = 'activa' do update
    set plan_id           = excluded.plan_id,
        fecha_inicio      = excluded.fecha_inicio,
        fecha_vencimiento = excluded.fecha_vencimiento,
        estado            = 'activa'
  returning * into v_membership;

  -- Asocia el pago con la membresía creada/renovada.
  update public.payments
     set membership_id = v_membership.id
   where transaction_id = p_transaction_id;

  -- Actualiza el plan activo del perfil del usuario.
  update public.profiles
     set plan_id = p_plan_id
   where id = p_user_id;

  return v_membership;
end;
$$;

revoke all on function public.procesar_pago_exitoso(text, uuid, uuid, numeric, text) from anon;
revoke all on function public.procesar_pago_exitoso(text, uuid, uuid, numeric, text) from public;
grant execute on function public.procesar_pago_exitoso(text, uuid, uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: los clientes reciben los cambios de pagos y membresías.
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.payments;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.memberships;
exception
  when duplicate_object then null;
end $$;