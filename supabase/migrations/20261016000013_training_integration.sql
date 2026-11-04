-- Sprint 3: authorization and atomic routine creation.
create or replace function public.can_read_training_routine(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.routines r where r.id = p_id and
    (r.is_default or r.created_by = auth.uid() or exists (
      select 1 from public.routine_assignments a where a.routine_id = r.id
      and a.client_id = auth.uid() and a.active)));
$$;
revoke all on function public.can_read_training_routine(uuid) from public;
grant execute on function public.can_read_training_routine(uuid) to authenticated;

drop policy if exists "Leer rutinas" on public.routines;
create policy "Leer rutinas" on public.routines for select to authenticated
using (public.can_read_training_routine(id));
drop policy if exists "Leer ejercicios de rutina" on public.routine_exercises;
create policy "Leer ejercicios de rutina" on public.routine_exercises for select to authenticated
using (public.can_read_training_routine(routine_id));
drop policy if exists "Crear rutinas" on public.routines;
create policy "Crear rutinas" on public.routines for insert to authenticated
with check (created_by = auth.uid() and public.current_gym_role() in ('admin','trainer'));
drop policy if exists "Actualizar rutinas propias" on public.routines;
create policy "Actualizar rutinas propias" on public.routines for update to authenticated
using (created_by = auth.uid() and public.current_gym_role() in ('admin','trainer'))
with check (created_by = auth.uid() and public.current_gym_role() in ('admin','trainer'));
drop policy if exists "Eliminar rutinas propias" on public.routines;
create policy "Eliminar rutinas propias" on public.routines for delete to authenticated
using (created_by = auth.uid() and public.current_gym_role() in ('admin','trainer'));

drop policy if exists "Asignar rutinas" on public.routine_assignments;
create policy "Asignar rutinas" on public.routine_assignments for insert to authenticated
with check (assigned_by = auth.uid() and public.current_gym_role() in ('admin','trainer')
  and exists (select 1 from public.routines r where r.id = routine_id and r.created_by = auth.uid()));
drop policy if exists "Actualizar asignaciones" on public.routine_assignments;
create policy "Actualizar asignaciones" on public.routine_assignments for update to authenticated
using (public.current_gym_role() in ('admin','trainer') and exists (
  select 1 from public.routines r where r.id = routine_id and r.created_by = auth.uid()))
with check (assigned_by = auth.uid() and public.current_gym_role() in ('admin','trainer') and exists (
  select 1 from public.routines r where r.id = routine_id and r.created_by = auth.uid()));

create or replace function public.create_training_routine(p_title text, p_description text, p_exercises jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or public.current_gym_role() not in ('admin','trainer') then
    raise exception 'Se requiere una cuenta de entrenador';
  end if;
  if length(trim(p_title)) = 0 or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'La rutina necesita nombre y ejercicios';
  end if;
  insert into public.routines(title,description,created_by)
    values(trim(p_title),p_description,auth.uid()) returning id into v_id;
  insert into public.routine_exercises(routine_id,exercise_id,sets,target_reps,target_duration_sec,rest_duration_sec,order_index)
    select v_id, x.exercise_id,x.sets,x.target_reps,x.target_duration_sec,x.rest_duration_sec,x.order_index
    from jsonb_to_recordset(p_exercises) as x(exercise_id text,sets integer,target_reps integer,
      target_duration_sec integer,rest_duration_sec integer,order_index integer);
  return v_id;
end;
$$;
revoke all on function public.create_training_routine(text,text,jsonb) from public;
grant execute on function public.create_training_routine(text,text,jsonb) to authenticated;
-- Enforce exactly one training target on new writes; preserve existing rows for review.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'routine_exercise_one_target') then
    alter table public.routine_exercises add constraint routine_exercise_one_target
      check ((target_reps is null) <> (target_duration_sec is null)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'routine_session_array') then
    alter table public.routine_sessions add constraint routine_session_array
      check (jsonb_typeof(exercises) = 'array' and duration_sec >= 0) not valid;
  end if;
end $$;
