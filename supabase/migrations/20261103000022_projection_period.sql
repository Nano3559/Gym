-- Sprint 6 nuevo: periodo explícito y reinicio sin borrar pronósticos. Requiere hasta 21.
begin;
alter table public.progress_profiles add column projection_restart_on date;
alter table public.progress_projections drop constraint progress_projections_method_version_check;
alter table public.progress_projections add constraint progress_projections_method_version_check check(method_version in ('observed-weekly-v1','observed-weekly-v2'));
-- El inicio de periodo solo se cambia mediante la RPC, no desde un perfil obsoleto.
revoke update on public.progress_profiles from authenticated;
grant update(user_id,height_cm,activity_level,formula_sex,timezone,estimates_paused) on public.progress_profiles to authenticated;
create function public.restart_progress_projection() returns date
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_zone text; v_start date;
begin
  if v_user is null then raise exception 'Inicia sesión'; end if;
  select timezone into v_zone from public.progress_profiles where user_id=v_user for update;
  if not found then raise exception 'Completa tu perfil'; end if;
  v_start:=(clock_timestamp() at time zone v_zone)::date+1;
  update public.progress_profiles set projection_restart_on=v_start where user_id=v_user;
  return v_start;
end;
$$;
revoke all on function public.restart_progress_projection() from public,anon,authenticated;
grant execute on function public.restart_progress_projection() to authenticated;
create or replace function public.get_projection_data(p_timezone text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_user uuid:=auth.uid(); v_end date;
begin
  if v_user is null then raise exception 'Inicia sesión'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Zona horaria no válida'; end if;
  v_end:=(now() at time zone p_timezone)::date-1;
  return jsonb_build_object('asOf',v_end,'read_at',now(),
    'restartOn',(select projection_restart_on from public.progress_profiles where user_id=v_user),
    'windows',jsonb_build_array(public.get_balance_data(v_end-83,v_end-56,p_timezone),public.get_balance_data(v_end-55,v_end-28,p_timezone),public.get_balance_data(v_end-27,v_end,p_timezone)),
    'goal',(select to_jsonb(g) from public.weight_goals g where g.user_id=v_user and g.ended_at is null),
    'history',coalesce((select jsonb_agg(h order by h.as_of desc) from (select * from public.progress_projections where user_id=v_user and timezone=p_timezone order by as_of desc limit 12) h),'[]'::jsonb));
end $$;

create or replace function public.save_progress_projection(p_snapshot jsonb,p_operation uuid,p_previous uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_prev public.progress_projections; v_zone text; v_day date; v_slope numeric; v_correction numeric; v_restart date;
begin
  if v_user is null then raise exception 'Inicia sesión'; end if;
  if p_operation is null or jsonb_typeof(p_snapshot) is distinct from 'object' or pg_column_size(p_snapshot)>2097152 then raise exception 'Proyección no válida'; end if;
  select projection_restart_on into v_restart from public.progress_profiles where user_id=v_user for update;
  if not found then raise exception 'Completa tu perfil'; end if;
  select id into v_id from public.progress_projections where user_id=v_user and operation_id=p_operation;
  if found then return v_id; end if;
  v_zone:=p_snapshot->>'timezone'; v_day:=(p_snapshot->>'asOf')::date;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_zone) then raise exception 'Zona horaria no válida'; end if;
  if v_day is null or v_day<>(now() at time zone v_zone)::date-1 then raise exception 'La emisión debe corresponder a ayer'; end if;
  if (p_snapshot->>'restartOn')::date is distinct from v_restart then raise exception 'El periodo cambió; actualiza la proyección'; end if;
  if v_restart is not null and v_day-27<v_restart then raise exception 'Faltan 28 días completos desde el reinicio'; end if;
  if p_snapshot->>'version' is null or p_snapshot->>'version' not in ('observed-weekly-v1','observed-weekly-v2') or p_snapshot->>'ready' is distinct from 'true'
    or p_snapshot->>'targetDay' is distinct from (v_day+7)::text or (p_snapshot->>'horizon')::integer is distinct from 7
    or jsonb_typeof(p_snapshot->'inputs') is distinct from 'object'
    or jsonb_typeof(p_snapshot->'inputs'->'weights') is distinct from 'array'
    or jsonb_typeof(p_snapshot->'inputs'->'balance') is distinct from 'array'
    or jsonb_typeof(p_snapshot->'weeks') is distinct from 'array' or jsonb_array_length(p_snapshot->'weeks')<>4
    or (p_snapshot->>'previousId')::uuid is distinct from p_previous
    then raise exception 'Instantánea no válida'; end if;
  v_slope:=(p_snapshot->>'slope')::numeric; v_correction:=(p_snapshot->>'correction')::numeric;
  if v_slope is null or v_slope not between -0.1 and 0.1 or v_correction is null or v_correction not between -200 and 200
    or (p_snapshot->>'anchor')::numeric is null or (p_snapshot->>'anchor')::numeric not between 20 and 500
    or (p_snapshot->>'projected')::numeric is null or (p_snapshot->>'projected')::numeric not between 19 and 501
    or (p_snapshot->>'rawSlope')::numeric is null or (p_snapshot->>'rawSlope')::numeric not between -0.1 and 0.1
    or (p_snapshot->>'recentSlope')::numeric is null or (p_snapshot->>'recentSlope')::numeric not between -0.1 and 0.1
    or (p_snapshot->'scenarios'->>'low')::numeric is null or (p_snapshot->'scenarios'->>'high')::numeric is null
    or (p_snapshot->'scenarios'->>'low')::numeric > (p_snapshot->>'projected')::numeric
    or (p_snapshot->'scenarios'->>'high')::numeric < (p_snapshot->>'projected')::numeric
    or abs((p_snapshot->>'projected')::numeric-((p_snapshot->>'anchor')::numeric+v_slope*7))>0.001
    then raise exception 'Valores fuera de los límites del método'; end if;
  select * into v_prev from public.progress_projections where user_id=v_user and timezone=v_zone and (v_restart is null or as_of>=v_restart) order by as_of desc limit 1;
  if v_prev.id is distinct from p_previous then raise exception 'El historial cambió; vuelve a consultar'; end if;
  if v_prev.id is null then
    if v_correction<>0 then raise exception 'La primera emisión no ajusta energía'; end if;
  else
    if v_prev.method_version='observed-weekly-v2' and p_snapshot->>'version'='observed-weekly-v1' then raise exception 'Actualiza la aplicación para emitir con el método vigente'; end if;
    if v_day-v_prev.as_of<7 then raise exception 'Espera siete días entre emisiones'; end if;
    if v_day-v_prev.as_of>28 or v_prev.method_version is distinct from p_snapshot->>'version' then
      if v_correction<>0 then raise exception 'Una cadena nueva no conserva ajuste energético'; end if;
    elsif abs(v_correction-(v_prev.snapshot->>'correction')::numeric)>25 or abs(v_slope-(v_prev.snapshot->>'slope')::numeric)>0.0101
      then raise exception 'El ajuste supera el paso permitido'; end if;
  end if;
  insert into public.progress_projections(user_id,as_of,timezone,method_version,operation_id,snapshot)
    values(v_user,v_day,v_zone,p_snapshot->>'version',p_operation,p_snapshot) returning id into v_id;
  return v_id;
end $$;
commit;
