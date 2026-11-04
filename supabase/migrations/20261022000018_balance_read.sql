-- Sprint 4: lectura coherente, acotada y por propietario. No modifica datos.
begin;
create function public.get_balance_data(p_start date,p_end date,p_timezone text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_user uuid:=auth.uid(); v_lower timestamptz; v_upper timestamptz; v_result jsonb;
begin
  if v_user is null then raise exception 'Inicia sesión'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>30 then raise exception 'Selecciona un periodo de 1 a 31 días'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Zona horaria no válida'; end if;
  if p_end>(now() at time zone p_timezone)::date then raise exception 'El periodo no puede estar en el futuro'; end if;
  -- Margen de un día para cambios de zona a medianoche. El cliente delimita
  -- cada día con sus fronteras IANA exactas; no se asume que dure 24 horas.
  v_lower:=((p_start-1)::timestamp at time zone p_timezone);
  v_upper:=((p_end+2)::timestamp at time zone p_timezone);
  select jsonb_build_object(
    'read_at',now(),
    'profile',(select to_jsonb(p) from public.progress_profiles p where p.user_id=v_user),
    'birthDate',(select p.fecha_nacimiento from public.profiles p where p.id=v_user),
    'meals',coalesce((select jsonb_agg(m order by m.consumed_at,m.id) from public.meal_logs m where m.user_id=v_user and m.consumed_at>=v_lower and m.consumed_at<v_upper),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(s order by s.occurred_at,s.id) from public.routine_sessions s where s.user_id=v_user and s.completed_at>v_lower and s.occurred_at<v_upper),'[]'::jsonb),
    'weights',coalesce((select jsonb_agg(w order by w.measured_at,w.created_at,w.id) from (
      select * from public.weight_logs where user_id=v_user and measured_at>=v_lower and measured_at<v_upper
      union all
      (select * from public.weight_logs where user_id=v_user and measured_at<v_lower order by measured_at desc,created_at desc,id limit 1)
    ) w),'[]'::jsonb),
    'annotations',coalesce((select jsonb_agg(a order by a.session_id) from public.energy_activity_annotations a where a.user_id=v_user and exists(select 1 from public.routine_sessions s where s.id=a.session_id and s.user_id=v_user and s.completed_at>v_lower and s.occurred_at<v_upper)),'[]'::jsonb),
    'statuses',coalesce((select jsonb_agg(t order by t.local_date) from public.daily_tracking_status t where t.user_id=v_user and t.timezone=p_timezone and t.local_date between p_start and p_end),'[]'::jsonb),
    'estimates',coalesce((select jsonb_agg(e order by e.created_at desc,e.id) from (
      select distinct on(local_date) * from public.daily_energy_estimates where user_id=v_user and timezone=p_timezone and local_date between p_start and p_end order by local_date,created_at desc,id desc
    ) e),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.get_balance_data(date,date,text) from public;
grant execute on function public.get_balance_data(date,date,text) to authenticated;
commit;
