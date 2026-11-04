-- ============================================================================
-- Sprint 3 — Asignación de rutinas a clientes
-- Tabla: routine_assignments
-- ============================================================================

create table if not exists public.routine_assignments (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  active boolean not null default true,
  unique (routine_id, client_id)
);

create index if not exists idx_routine_assignments_client on public.routine_assignments (client_id);
create index if not exists idx_routine_assignments_routine on public.routine_assignments (routine_id);
create index if not exists idx_routine_assignments_active on public.routine_assignments (client_id) where active;

-- ---------------------------------------------------------------------------
-- RLS: routine_assignments
-- ---------------------------------------------------------------------------
alter table public.routine_assignments enable row level security;

-- Los clientes pueden ver sus propias asignaciones.
drop policy if exists "Leer asignaciones propias" on public.routine_assignments;
create policy "Leer asignaciones propias"
  on public.routine_assignments for select
  to authenticated
  using (client_id = auth.uid());

-- Los entrenadores pueden ver asignaciones de sus rutinas.
drop policy if exists "Leer asignaciones de rutinas propias" on public.routine_assignments;
create policy "Leer asignaciones de rutinas propias"
  on public.routine_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_id
        and r.created_by = auth.uid()
    )
  );

-- Solo entrenadores pueden asignar rutinas.
drop policy if exists "Asignar rutinas" on public.routine_assignments;
create policy "Asignar rutinas"
  on public.routine_assignments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_id
        and r.created_by = auth.uid()
    )
  );

-- Solo entrenadores pueden actualizar asignaciones de sus rutinas.
drop policy if exists "Actualizar asignaciones" on public.routine_assignments;
create policy "Actualizar asignaciones"
  on public.routine_assignments for update
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

-- Solo entrenadores pueden eliminar asignaciones de sus rutinas.
drop policy if exists "Eliminar asignaciones" on public.routine_assignments;
create policy "Eliminar asignaciones"
  on public.routine_assignments for delete
  to authenticated
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_id
        and r.created_by = auth.uid()
    )
  );
