-- ============================================================================
-- Sprint 3 — Rutinas del entrenador
-- Tablas: routines, routine_exercises
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- routines: rutinas creadas por entrenadores o predeterminadas del sistema.
-- ---------------------------------------------------------------------------
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_routines_created_by on public.routines (created_by);
create index if not exists idx_routines_is_default on public.routines (is_default) where is_default;

-- ---------------------------------------------------------------------------
-- routine_exercises: ejercicios que componen una rutina, con su configuración.
-- ---------------------------------------------------------------------------
create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  exercise_id text not null,
  sets integer not null default 1 check (sets > 0),
  target_reps integer check (target_reps > 0),
  target_duration_sec integer check (target_duration_sec > 0),
  rest_duration_sec integer not null default 60 check (rest_duration_sec >= 0),
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  unique (routine_id, order_index)
);

create index if not exists idx_routine_exercises_routine on public.routine_exercises (routine_id);
create index if not exists idx_routine_exercises_exercise on public.routine_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- RLS: rutinas
-- ---------------------------------------------------------------------------
alter table public.routines enable row level security;

-- Cualquier usuario autenticado puede leer rutinas predeterminadas o propias.
drop policy if exists "Leer rutinas" on public.routines;
create policy "Leer rutinas"
  on public.routines for select
  to authenticated
  using (is_default = true or created_by = auth.uid());

-- Solo entrenadores/admin pueden crear rutinas (el rol se valida en el cliente
-- o vía un campo en profiles; aquí se permite a cualquier autenticado como base).
drop policy if exists "Crear rutinas" on public.routines;
create policy "Crear rutinas"
  on public.routines for insert
  to authenticated
  with check (created_by = auth.uid());

-- Solo el creador puede actualizar sus rutinas.
drop policy if exists "Actualizar rutinas propias" on public.routines;
create policy "Actualizar rutinas propias"
  on public.routines for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Solo el creador puede eliminar sus rutinas.
drop policy if exists "Eliminar rutinas propias" on public.routines;
create policy "Eliminar rutinas propias"
  on public.routines for delete
  to authenticated
  using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: routine_exercises
-- ---------------------------------------------------------------------------
alter table public.routine_exercises enable row level security;

-- Se pueden leer los ejercicios de rutinas visibles.
drop policy if exists "Leer ejercicios de rutina" on public.routine_exercises;
create policy "Leer ejercicios de rutina"
  on public.routine_exercises for select
  to authenticated
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_id
        and (r.is_default = true or r.created_by = auth.uid())
    )
  );

-- Solo el creador de la rutina puede añadir ejercicios.
drop policy if exists "Añadir ejercicios a rutina" on public.routine_exercises;
create policy "Añadir ejercicios a rutina"
  on public.routine_exercises for insert
  to authenticated
  with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_id
        and r.created_by = auth.uid()
    )
  );

-- Solo el creador de la rutina puede actualizar ejercicios.
drop policy if exists "Actualizar ejercicios de rutina" on public.routine_exercises;
create policy "Actualizar ejercicios de rutina"
  on public.routine_exercises for update
  to authenticated
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_id
        and r.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_id
        and r.created_by = auth.uid()
    )
  );

-- Solo el creador de la rutina puede eliminar ejercicios.
drop policy if exists "Eliminar ejercicios de rutina" on public.routine_exercises;
create policy "Eliminar ejercicios de rutina"
  on public.routine_exercises for delete
  to authenticated
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_id
        and r.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Trigger: actualiza updated_at automáticamente.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_routines_updated_at on public.routines;
create trigger trg_routines_updated_at
  before update on public.routines
  for each row execute procedure public.set_updated_at();
