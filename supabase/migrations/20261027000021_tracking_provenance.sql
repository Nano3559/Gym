-- Sprint 2 nuevo. Requiere 16 y 20. Conserva originales previos desde su aplicación.
begin;
create table public.tracking_revisions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid not null,
  record_type text not null check(record_type in ('meal_logs','routine_sessions')),
  action text not null check(action in ('UPDATE','DELETE')),
  recorded_at timestamptz not null default clock_timestamp(),
  before_record jsonb not null,
  after_record jsonb
);
create index tracking_revisions_owner on public.tracking_revisions(user_id,recorded_at desc);
alter table public.tracking_revisions enable row level security;
create policy tracking_revision_own on public.tracking_revisions for select to authenticated using(user_id=auth.uid());
revoke all on public.tracking_revisions from public,anon,authenticated;
grant select on public.tracking_revisions to authenticated;
revoke all on sequence public.tracking_revisions_id_seq from public,anon,authenticated;

create function public.preserve_tracking_origin() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.user_id is distinct from old.user_id then raise exception 'No se permite cambiar propietario'; end if;
    new.operation_id:=old.operation_id;
    new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
    if tg_table_name='meal_logs' then new.source:=old.source; end if;
  else
    new.updated_at:=clock_timestamp();
  end if;
  if tg_table_name='meal_logs' then
    if new.confirmation='confirmed' and new.portions<0.01 then raise exception 'Porciones no válidas'; end if;
  end if;
  return new;
end;
$$;
-- Ejecuta después de los validadores existentes para mantener token creciente.
create trigger zz_meal_origin before insert or update on public.meal_logs for each row execute function public.preserve_tracking_origin();
create trigger zz_session_origin before insert or update on public.routine_sessions for each row execute function public.preserve_tracking_origin();
revoke all on function public.preserve_tracking_origin() from public,anon,authenticated;

create function public.audit_tracking_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from auth.users where id=old.user_id) then
    insert into public.tracking_revisions(user_id,record_id,record_type,action,before_record,after_record)
    values(old.user_id,old.id,tg_table_name,tg_op,to_jsonb(old),case when tg_op='UPDATE' then to_jsonb(new) else null end);
  end if;
  return null;
end;
$$;
revoke all on function public.audit_tracking_change() from public,anon,authenticated;
create trigger meal_audit after update or delete on public.meal_logs for each row execute function public.audit_tracking_change();
create trigger session_audit after update or delete on public.routine_sessions for each row execute function public.audit_tracking_change();

-- Invalidar según la zona de cada confirmación, no solo la zona del registro.
-- Incluye eliminación y ambos días de una corrección que cambie la fecha.
create or replace function public.invalidate_tracking_completeness() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_old timestamptz; v_new timestamptz;
begin
  if tg_op='DELETE' then v_owner:=old.user_id; else v_owner:=new.user_id; end if;
  if tg_table_name='meal_logs' then
    if tg_op<>'INSERT' then v_old:=old.consumed_at; end if;
    if tg_op<>'DELETE' then v_new:=new.consumed_at; end if;
    update public.daily_tracking_status s set meals_complete=false
    where s.user_id=v_owner and (s.local_date=(v_old at time zone s.timezone)::date or s.local_date=(v_new at time zone s.timezone)::date);
  else
    if tg_op<>'INSERT' then v_old:=old.occurred_at; end if;
    if tg_op<>'DELETE' then v_new:=new.occurred_at; end if;
    update public.daily_tracking_status s set activity_complete=false
    where s.user_id=v_owner and (s.local_date=(v_old at time zone s.timezone)::date or s.local_date=(v_new at time zone s.timezone)::date);
  end if;
  return null;
end;
$$;
drop trigger meal_invalidate_day on public.meal_logs;
drop trigger session_invalidate_day on public.routine_sessions;
create trigger meal_invalidate_day after insert or update or delete on public.meal_logs for each row execute function public.invalidate_tracking_completeness();
create trigger session_invalidate_day after insert or update or delete on public.routine_sessions for each row execute function public.invalidate_tracking_completeness();
revoke all on function public.invalidate_tracking_completeness() from public,anon,authenticated;
commit;
