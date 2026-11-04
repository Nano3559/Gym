-- ============================================================================
-- Módulo 6 — Escáner nutricional
--
-- * Tabla `meal_logs`: diario de comidas del socio, una fila por análisis.
--
-- Ejecutar en el SQL Editor de Supabase tras la migración 20260820000005.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- meal_logs: comidas registradas por el escáner nutricional.
-- `user_id` apunta al socio dueño del registro: el diario es siempre personal.
-- ---------------------------------------------------------------------------
create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  alimento text not null,
  descripcion text,
  calorias integer not null default 0 check (calorias >= 0),
  proteinas_g numeric(7, 2) not null default 0 check (proteinas_g >= 0),
  carbohidratos_g numeric(7, 2) not null default 0 check (carbohidratos_g >= 0),
  grasas_g numeric(7, 2) not null default 0 check (grasas_g >= 0),
  -- La IA marca cuándo la imagen no era comida: el registro se conserva, pero
  -- la interfaz avisa de que la estimación no es fiable.
  es_comida boolean not null default true,
  imagen_url text,
  registrado_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_meal_logs_user on public.meal_logs (user_id);
create index if not exists idx_meal_logs_user_registrado on public.meal_logs (user_id, registrado_at desc);
create index if not exists idx_meal_logs_es_comida on public.meal_logs (user_id) where not es_comida;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.meal_logs enable row level security;

-- El socio solo lee su propio diario.
drop policy if exists "Leer comidas propias" on public.meal_logs;
create policy "Leer comidas propias"
  on public.meal_logs for select
  to authenticated
  using (auth.uid() = user_id);

-- El socio escribe únicamente en su propio diario.
drop policy if exists "Crear comidas propias" on public.meal_logs;
create policy "Crear comidas propias"
  on public.meal_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Sin policies de UPDATE ni DELETE: el diario es un historial append-only y
-- corregir un registro se hace introducing otro, nunca reescribiendo el pasado.

-- ---------------------------------------------------------------------------
-- Realtime: el diario se actualiza en vivo si la interfaz lo tiene abierto.
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.meal_logs;
exception
  when duplicate_object then null;
end $$;
