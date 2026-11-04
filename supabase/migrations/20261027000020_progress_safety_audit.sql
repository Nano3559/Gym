-- Sprint 1 del agente nuevo. Aplicar después de 15–19.
begin;
alter table public.progress_profiles add column estimates_paused boolean not null default false;

-- Un token de revisión estrictamente creciente evita colisiones dentro de una transacción.
create or replace function public.validate_progress_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Zona horaria no válida';
  end if;
  if tg_table_name = 'weight_logs' then
    if new.measured_at > now() then raise exception 'El pesaje no puede estar en el futuro'; end if;
    new.local_date := (new.measured_at at time zone new.timezone)::date;
  end if;
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then raise exception 'No se permite cambiar propietario'; end if;
    new.created_at := old.created_at;
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  else
    new.created_at := clock_timestamp();
    new.updated_at := new.created_at;
  end if;
  return new;
end;
$$;

create table public.weight_log_revisions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_id uuid not null,
  action text not null check(action in ('UPDATE','DELETE')),
  recorded_at timestamptz not null default clock_timestamp(),
  before_record jsonb not null,
  after_record jsonb
);
create index weight_log_revisions_owner on public.weight_log_revisions(user_id, recorded_at desc);
alter table public.weight_log_revisions enable row level security;
create policy weight_log_revision_read on public.weight_log_revisions for select to authenticated using(user_id=auth.uid());
revoke all on public.weight_log_revisions from public, anon, authenticated;
grant select on public.weight_log_revisions to authenticated;
revoke all on sequence public.weight_log_revisions_id_seq from public, anon, authenticated;

create function public.audit_weight_log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- AFTER trigger: only changes that succeed are recorded, atomically.
  -- Account deletion cascades must not recreate retained personal data.
  if not exists(select 1 from auth.users where id=old.user_id) then return null; end if;
  insert into public.weight_log_revisions(user_id,log_id,action,before_record,after_record)
  values(old.user_id,old.id,tg_op,to_jsonb(old),case when tg_op='UPDATE' then to_jsonb(new) else null end);
  return null;
end;
$$;
revoke all on function public.audit_weight_log_change() from public, anon, authenticated;
create trigger weight_log_audit after update or delete on public.weight_logs
for each row execute function public.audit_weight_log_change();

-- Serializa la emisión con cambios de perfil: un cliente antiguo no puede ignorar la pausa.
create function public.check_projection_pause() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_paused boolean;
begin
  select estimates_paused into v_paused from public.progress_profiles where user_id=new.user_id for update;
  if v_paused then raise exception 'Las estimaciones están suspendidas en Mi progreso'; end if;
  return new;
end;
$$;
revoke all on function public.check_projection_pause() from public, anon, authenticated;
create trigger projection_pause before insert on public.progress_projections
for each row execute function public.check_projection_pause();
create trigger energy_pause before insert on public.daily_energy_estimates
for each row execute function public.check_projection_pause();
commit;
