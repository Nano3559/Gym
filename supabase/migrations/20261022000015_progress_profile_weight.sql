-- Hito 4 / sprint 1: perfil personal, metas versionadas y pesajes.
begin;
create table public.progress_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  height_cm numeric(5,1) not null check (height_cm between 100 and 250),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','high')),
  formula_sex text check (formula_sex in ('female','male')),
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.weight_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.progress_profiles(user_id) on delete cascade,
  target_weight_kg numeric(5,2) not null check (target_weight_kg between 20 and 500),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  operation_id uuid not null,
  unique(user_id, operation_id),
  check (ended_at is null or ended_at >= started_at)
);
create unique index weight_goals_one_active on public.weight_goals(user_id) where ended_at is null;
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.progress_profiles(user_id) on delete cascade,
  weight_kg numeric(5,2) not null check (weight_kg between 20 and 500),
  measured_at timestamptz not null,
  timezone text not null,
  local_date date not null,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, operation_id)
);
create index weight_logs_user_time on public.weight_logs(user_id, measured_at desc);
create index weight_goals_user_time on public.weight_goals(user_id, started_at desc);

create function public.validate_progress_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Zona horaria no válida';
  end if;
  if tg_table_name = 'weight_logs' then
    if new.measured_at > now() then raise exception 'El pesaje no puede estar en el futuro'; end if;
    new.local_date := (new.measured_at at time zone new.timezone)::date;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger progress_profile_validation before insert or update on public.progress_profiles
for each row execute function public.validate_progress_record();
create trigger weight_log_validation before insert or update on public.weight_logs
for each row execute function public.validate_progress_record();

alter table public.progress_profiles enable row level security;
alter table public.weight_logs enable row level security;
alter table public.weight_goals enable row level security;
create policy progress_profile_own on public.progress_profiles for all to authenticated
using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy weight_log_own on public.weight_logs for all to authenticated
using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy weight_goal_read_own on public.weight_goals for select to authenticated using(user_id = auth.uid());
revoke all on public.progress_profiles, public.weight_logs, public.weight_goals from anon, authenticated;
grant select, insert, update on public.progress_profiles to authenticated;
grant select, insert, update, delete on public.weight_logs to authenticated;
grant select on public.weight_goals to authenticated;

-- Única vía de cambiar la meta: preserva historia, es atómica y serializa por usuario.
create function public.set_weight_goal(p_target numeric, p_operation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Inicia sesión'; end if;
  if p_target is null or p_target not between 20 and 500 or p_operation is null then raise exception 'Meta no válida'; end if;
  perform 1 from public.progress_profiles where user_id = v_user for update;
  if not found then raise exception 'Completa tu perfil de progreso'; end if;
  select id into v_id from public.weight_goals where user_id = v_user and operation_id = p_operation;
  if found then return v_id; end if;
  update public.weight_goals set ended_at = now() where user_id = v_user and ended_at is null;
  insert into public.weight_goals(user_id,target_weight_kg,operation_id) values(v_user,p_target,p_operation) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.set_weight_goal(numeric,uuid) from public;
grant execute on function public.set_weight_goal(numeric,uuid) to authenticated;
revoke all on function public.validate_progress_record() from public;
commit;
