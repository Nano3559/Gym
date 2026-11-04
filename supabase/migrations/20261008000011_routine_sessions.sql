-- ============================================================================
-- Sprint 3 — Historial de sesiones completadas
-- Tabla: routine_sessions
-- ============================================================================

create table if not exists public.routine_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  routine_title text not null,
  exercises jsonb not null default '[]',
  duration_sec integer not null default 0,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_routine_sessions_user on public.routine_sessions (user_id);
create index if not exists idx_routine_sessions_completed on public.routine_sessions (completed_at desc);
create index if not exists idx_routine_sessions_user_completed on public.routine_sessions (user_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- RLS: routine_sessions
-- ---------------------------------------------------------------------------
alter table public.routine_sessions enable row level security;

-- Los usuarios pueden ver su propio historial.
drop policy if exists "Leer historial propio" on public.routine_sessions;
create policy "Leer historial propio"
  on public.routine_sessions for select
  to authenticated
  using (user_id = auth.uid());

-- Los usuarios pueden guardar sus propias sesiones.
drop policy if exists "Guardar sesiones propias" on public.routine_sessions;
create policy "Guardar sesiones propias"
  on public.routine_sessions for insert
  to authenticated
  with check (user_id = auth.uid());

-- Los usuarios no pueden actualizar ni eliminar su historial.
