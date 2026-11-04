-- Base de pruebas con migraciones hasta 22. Todo se revierte.
begin;
set local time zone 'UTC';
insert into auth.users(id,email) values
('15000000-0000-4000-8000-000000000001','period-a@example.invalid'),
('15000000-0000-4000-8000-000000000002','period-b@example.invalid');
insert into public.progress_profiles(user_id,height_cm,activity_level,timezone)
select id,180,'light','UTC' from auth.users where id in
('15000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000002');
insert into public.progress_projections(id,user_id,as_of,timezone,method_version,operation_id,snapshot)
values('15000000-0000-4000-8000-000000000010','15000000-0000-4000-8000-000000000001',current_date-40,'UTC','observed-weekly-v1',gen_random_uuid(),'{"version":"observed-weekly-v1","slope":-0.09,"correction":150}');
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
do $$ declare s jsonb; v_start date; begin
  s:=jsonb_build_object('version','observed-weekly-v2','ready',true,'asOf',current_date-1,'timezone','UTC','targetDay',current_date+6,'horizon',7,'anchor',80,'projected',80,'rawSlope',0,'recentSlope',0,'slope',0,'correction',0,'scenarios',jsonb_build_object('low',80,'high',80),'previousId','15000000-0000-4000-8000-000000000010','weeks','[{}, {}, {}, {}]'::jsonb,'inputs','{"weights":[],"balance":[]}'::jsonb);
  begin
    perform public.save_progress_projection(jsonb_set(s,'{correction}','25'),gen_random_uuid(),'15000000-0000-4000-8000-000000000010');
    raise exception 'Se conservó ajuste tras interrupción';
  exception when raise_exception then if sqlerrm<>'Una cadena nueva no conserva ajuste energético' then raise; end if; end;
  perform public.save_progress_projection(s,gen_random_uuid(),'15000000-0000-4000-8000-000000000010');
  v_start:=public.restart_progress_projection();
  if v_start<>current_date+1 then raise exception 'Reinicio no comienza mañana'; end if;
  if (select count(*) from public.progress_projections)<>2 then raise exception 'Reinicio alteró historial'; end if;
  if (public.get_projection_data('UTC')->>'restartOn')::date<>v_start then raise exception 'Lectura no refleja periodo'; end if;
  begin
    update public.progress_profiles set projection_restart_on=null where user_id=auth.uid();
    raise exception 'Cliente quitó reinicio directamente';
  exception when insufficient_privilege then null; end;
  update public.progress_profiles set height_cm=181 where user_id=auth.uid();
  if not found then raise exception 'Perfil normal dejó de poder editarse'; end if;
  begin
    perform public.save_progress_projection(s,gen_random_uuid(),null);
    raise exception 'Solicitud antigua ignoró periodo';
  exception when raise_exception then if sqlerrm<>'El periodo cambió; actualiza la proyección' then raise; end if; end;
  begin
    perform public.save_progress_projection(jsonb_set(s,'{restartOn}',to_jsonb(v_start::text)),gen_random_uuid(),null);
    raise exception 'No exigió nuevo historial';
  exception when raise_exception then if sqlerrm<>'Faltan 28 días completos desde el reinicio' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.progress_projections) then raise exception 'Historial ajeno visible'; end if;
  if (select projection_restart_on from public.progress_profiles where user_id=auth.uid()) is not null then raise exception 'Reinicio afectó otro usuario'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin
    perform public.restart_progress_projection();
    raise exception 'Reinicio sin sesión';
  exception when raise_exception then if sqlerrm<>'Inicia sesión' then raise; end if; end;
end $$;
rollback;

