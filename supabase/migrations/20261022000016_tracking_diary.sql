-- Hito 4 / sprint 2. Requiere migración 15. No convierte análisis antiguos en consumo confirmado.
begin;
alter table public.meal_logs
  add column consumed_at timestamptz,
  add column timezone text,
  add column local_date date,
  add column source text not null default 'legacy' check(source in ('legacy','scan','manual')),
  add column confirmation text not null default 'legacy' check(confirmation in ('legacy','confirmed','void')),
  add column portion text,
  add column portions numeric(8,2) not null default 1 check(portions > 0 and portions <= 100),
  add column nutrition_per_portion jsonb,
  add column operation_id uuid,
  add column updated_at timestamptz not null default now();
update public.meal_logs set consumed_at = registrado_at;
alter table public.meal_logs alter column consumed_at set not null;
create unique index meal_logs_operation on public.meal_logs(user_id,operation_id);
create index meal_logs_consumed on public.meal_logs(user_id,consumed_at);
create function public.validate_meal_tracking() returns trigger language plpgsql set search_path = '' as $$
declare v_cal numeric; v_protein numeric; v_carbs numeric; v_fat numeric;
begin
  if new.confirmation = 'confirmed' then
    if not new.es_comida or length(trim(new.alimento)) = 0 then raise exception 'Confirma un alimento válido'; end if;
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Zona horaria no válida'; end if;
    if new.consumed_at > now() then raise exception 'La comida no puede estar en el futuro'; end if;
    if new.portion is null or length(trim(new.portion)) = 0 or new.nutrition_per_portion is null then raise exception 'Indica porción y nutrientes'; end if;
    v_cal := (new.nutrition_per_portion->>'calorias')::numeric;
    v_protein := (new.nutrition_per_portion->>'proteinas_g')::numeric;
    v_carbs := (new.nutrition_per_portion->>'carbohidratos_g')::numeric;
    v_fat := (new.nutrition_per_portion->>'grasas_g')::numeric;
    if v_cal is null or v_protein is null or v_carbs is null or v_fat is null
      or v_cal not between 0 and 50000 or v_protein not between 0 and 50000
      or v_carbs not between 0 and 50000 or v_fat not between 0 and 50000 then raise exception 'Nutrientes no válidos'; end if;
    new.calorias := round(v_cal * new.portions);
    new.proteinas_g := round(v_protein * new.portions,2);
    new.carbohidratos_g := round(v_carbs * new.portions,2);
    new.grasas_g := round(v_fat * new.portions,2);
    new.local_date := (new.consumed_at at time zone new.timezone)::date;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
create trigger meal_tracking_validation before insert or update on public.meal_logs
for each row execute function public.validate_meal_tracking();
create policy meal_update_own on public.meal_logs for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
grant update on public.meal_logs to authenticated;
-- Anular conserva la entrada y evita sumar correcciones como una segunda comida.

alter table public.routine_sessions
  add column operation_id uuid,
  add column started_at timestamptz,
  add column occurred_at timestamptz,
  add column timezone text,
  add column local_date date,
  add column session_status text not null default 'legacy' check(session_status in ('legacy','completed','partial','manual','void')),
  add column updated_at timestamptz not null default now(),
  add column active_sec integer check(active_sec >= 0),
  add column rest_sec integer check(rest_sec >= 0),
  add column preparation_sec integer check(preparation_sec >= 0),
  add column paused_sec integer check(paused_sec >= 0),
  add column intensity text check(intensity in ('light','moderate','high'));
update public.routine_sessions set occurred_at=completed_at;
create unique index routine_session_operation on public.routine_sessions(user_id,operation_id);
create index routine_session_occurred on public.routine_sessions(user_id,occurred_at);
create function public.validate_session_tracking() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.session_status in ('completed','partial','manual') then
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Zona horaria no válida'; end if;
    if new.started_at is null or new.started_at > now() or new.completed_at < new.started_at or new.completed_at > now() then raise exception 'Fechas de sesión no válidas'; end if;
    if new.active_sec is null or new.rest_sec is null or new.preparation_sec is null or new.paused_sec is null
      or new.active_sec+new.rest_sec+new.preparation_sec+new.paused_sec > new.duration_sec
      or new.duration_sec > ceil(extract(epoch from new.completed_at-new.started_at)) then raise exception 'Duraciones inconsistentes'; end if;
    if jsonb_typeof(new.exercises) <> 'array' then raise exception 'Series no válidas'; end if;
    if exists(select 1 from jsonb_array_elements(new.exercises) as item where
      jsonb_typeof(item) <> 'object' or coalesce(item->>'exerciseId','') = ''
      or coalesce((item->>'set')::numeric,0) < 1
      or coalesce((item->>'reps')::numeric,-1) < 0
      or coalesce((item->>'durationSec')::numeric,-1) < 0
      or ((item->>'loadKg') is not null and (item->>'loadKg')::numeric not between 0 and 1000)) then raise exception 'Detalle de series no válido'; end if;
    new.occurred_at := new.started_at;
    new.local_date := (new.started_at at time zone new.timezone)::date;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
create trigger session_tracking_validation before insert or update on public.routine_sessions
for each row execute function public.validate_session_tracking();
create policy session_update_own on public.routine_sessions for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
grant update on public.routine_sessions to authenticated;

create table public.daily_tracking_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone text not null,
  meals_complete boolean not null default false,
  activity_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,local_date,timezone)
);
create function public.validate_tracking_day() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Zona horaria no válida'; end if;
  if new.local_date > (now() at time zone new.timezone)::date then raise exception 'Día futuro no válido'; end if;
  new.updated_at := clock_timestamp(); return new;
end $$;
create trigger tracking_day_validation before insert or update on public.daily_tracking_status
for each row execute function public.validate_tracking_day();
-- Cualquier cambio del diario invalida la confirmación de completitud del día afectado.
create function public.invalidate_tracking_completeness() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'meal_logs' then
    update public.daily_tracking_status set meals_complete=false where user_id=new.user_id
      and local_date=(new.consumed_at at time zone new.timezone)::date and timezone=new.timezone;
    if tg_op='UPDATE' and old.timezone is not null then
      update public.daily_tracking_status set meals_complete=false where user_id=old.user_id
        and local_date=(old.consumed_at at time zone old.timezone)::date and timezone=old.timezone;
    end if;
  else
    update public.daily_tracking_status set activity_complete=false where user_id=new.user_id
      and local_date=new.local_date and timezone=new.timezone;
    if tg_op='UPDATE' then
      update public.daily_tracking_status set activity_complete=false where user_id=old.user_id
        and local_date=old.local_date and timezone=old.timezone;
    end if;
  end if;
  return new;
end $$;
create trigger meal_invalidate_day after insert or update on public.meal_logs
for each row execute function public.invalidate_tracking_completeness();
create trigger session_invalidate_day after insert or update on public.routine_sessions
for each row execute function public.invalidate_tracking_completeness();
alter table public.daily_tracking_status enable row level security;
create policy tracking_day_own on public.daily_tracking_status for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.daily_tracking_status from anon,authenticated;
grant select,insert,update on public.daily_tracking_status to authenticated;
create function public.set_tracking_day(p_day date,p_timezone text,p_meals boolean default null,p_activity boolean default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_meals and exists(select 1 from public.meal_logs where user_id=auth.uid()
    and confirmation='legacy' and (consumed_at at time zone p_timezone)::date=p_day) then
    raise exception 'Confirma o anula las comidas antiguas antes de marcar el día completo';
  end if;
  if p_activity and exists(select 1 from public.routine_sessions where user_id=auth.uid()
    and session_status='legacy' and (occurred_at at time zone p_timezone)::date=p_day) then
    raise exception 'Revisa las actividades antiguas antes de marcar el día completo';
  end if;
  insert into public.daily_tracking_status(user_id,local_date,timezone,meals_complete,activity_complete)
  values(auth.uid(),p_day,p_timezone,coalesce(p_meals,false),coalesce(p_activity,false))
  on conflict(user_id,local_date,timezone) do update set
    meals_complete=coalesce(p_meals,public.daily_tracking_status.meals_complete),
    activity_complete=coalesce(p_activity,public.daily_tracking_status.activity_complete);
end $$;
revoke all on function public.set_tracking_day(date,text,boolean,boolean) from public;
grant execute on function public.set_tracking_day(date,text,boolean,boolean) to authenticated;
revoke all on function public.validate_meal_tracking(),public.validate_session_tracking(),public.validate_tracking_day(),public.invalidate_tracking_completeness() from public;
commit;
