begin;
create table public.energy_activity_annotations (
  session_id uuid primary key references public.routine_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_code text not null check(activity_code in ('17190','02054','02022','02024','01010','01200')),
  updated_at timestamptz not null default now()
);
alter table public.energy_activity_annotations enable row level security;
create policy energy_annotation_own on public.energy_activity_annotations for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.routine_sessions s where s.id=session_id and s.user_id=auth.uid()));
revoke all on public.energy_activity_annotations from anon,authenticated;
grant select,insert,update,delete on public.energy_activity_annotations to authenticated;
create table public.daily_energy_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone text not null,
  method_version text not null check(method_version='mifflin-met-replacement-v1'),
  operation_id uuid not null,
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  created_at timestamptz not null default now(),
  unique(user_id,operation_id)
);
create index energy_estimate_day on public.daily_energy_estimates(user_id,local_date,created_at desc);
alter table public.daily_energy_estimates enable row level security;
create policy energy_estimate_own on public.daily_energy_estimates for select to authenticated using(user_id=auth.uid());
create policy energy_estimate_insert on public.daily_energy_estimates for insert to authenticated with check(user_id=auth.uid());
revoke all on public.daily_energy_estimates from anon,authenticated;
grant select,insert on public.daily_energy_estimates to authenticated;
-- Instantáneas inmutables de estimaciones del cliente; no son resultados certificados del servidor.
create function public.validate_energy_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Zona horaria no válida'; end if;
  if new.local_date>(now() at time zone new.timezone)::date then raise exception 'Día futuro no válido'; end if;
  if new.snapshot->>'version' is distinct from new.method_version or new.snapshot->>'day' is distinct from new.local_date::text
    or new.snapshot->>'timezone' is distinct from new.timezone or new.snapshot->>'total' is null
    or (new.snapshot->>'total')::numeric < 0 or (new.snapshot->>'total')::numeric > 50000
    or (new.snapshot->>'base')::numeric is null or (new.snapshot->>'exercise')::numeric is null
    or (new.snapshot->>'base')::numeric not between 0 and 50000 or (new.snapshot->>'exercise')::numeric not between 0 and 50000
    or (new.snapshot->>'total')::numeric <> (new.snapshot->>'base')::numeric+(new.snapshot->>'exercise')::numeric
    or jsonb_typeof(new.snapshot->'inputs') is distinct from 'object' then raise exception 'Instantánea energética no válida'; end if;
  return new;
end $$;
create trigger energy_snapshot_validation before insert on public.daily_energy_estimates for each row execute function public.validate_energy_snapshot();
revoke all on function public.validate_energy_snapshot() from public;
commit;
