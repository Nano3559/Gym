-- Requiere migraciones 1–19. Base de pruebas únicamente; todo se revierte.
begin;
set local time zone 'UTC';
insert into auth.users(id,email) values('14000000-0000-4000-8000-000000000001','projection-a@example.invalid'),('14000000-0000-4000-8000-000000000002','projection-b@example.invalid');
insert into public.progress_profiles(user_id,height_cm,activity_level,formula_sex,timezone)
select id,180,'light','male','UTC' from auth.users where id in ('14000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000002');
-- A previous immutable emission, seeded only by the test administrator.
insert into public.progress_projections(id,user_id,as_of,timezone,method_version,operation_id,snapshot)
values('14000000-0000-4000-8000-000000000010','14000000-0000-4000-8000-000000000001',current_date-8,'UTC','observed-weekly-v1','14000000-0000-4000-8000-000000000011','{"version":"observed-weekly-v1","slope":0,"correction":0}');
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
do $$ declare s jsonb; result uuid; again uuid; begin
  s:=jsonb_build_object('version','observed-weekly-v1','ready',true,'asOf',current_date-1,'timezone','UTC','targetDay',current_date+6,'horizon',7,'anchor',80,'projected',80.07,'rawSlope',0.01,'recentSlope',0.01,'slope',0.01,'correction',25,'scenarios',jsonb_build_object('low',80,'high',81),'previousId','14000000-0000-4000-8000-000000000010','weeks','[{}, {}, {}, {}]'::jsonb,'inputs','{"weights":[],"balance":[]}'::jsonb);
  begin
    perform public.save_progress_projection(jsonb_set(s,'{correction}','26'),'14000000-0000-4000-8000-000000000014','14000000-0000-4000-8000-000000000010');
    raise exception 'Se permitió ajuste excesivo';
  exception when raise_exception then if sqlerrm<>'El ajuste supera el paso permitido' then raise; end if; end;
  result:=public.save_progress_projection(s,'14000000-0000-4000-8000-000000000012','14000000-0000-4000-8000-000000000010');
  again:=public.save_progress_projection(s,'14000000-0000-4000-8000-000000000012','14000000-0000-4000-8000-000000000010');
  if result<>again or (select count(*) from public.progress_projections)<>2 then raise exception 'Reintento duplicado'; end if;
  begin
    perform public.save_progress_projection(jsonb_set(s,'{previousId}',to_jsonb(result::text)),'14000000-0000-4000-8000-000000000013',result);
    raise exception 'Se permitió emisión sin esperar';
  exception when raise_exception then if sqlerrm<>'Espera siete días entre emisiones' then raise; end if; end;
  begin
    update public.progress_projections set snapshot='{}'; raise exception 'Se permitió alterar historial';
  exception when insufficient_privilege then null; end;
  if jsonb_array_length(public.get_projection_data('UTC')->'windows')<>3 then raise exception 'Faltan ventanas de lectura'; end if;
end $$;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000002',true);
do $$ declare payload jsonb; begin
  if (select count(*) from public.progress_projections)<>0 then raise exception 'Se leyó historial ajeno'; end if;
  payload:=public.get_projection_data('UTC');
  if jsonb_array_length(payload->'history')<>0 then raise exception 'La RPC filtró historial ajeno'; end if;
  payload:=jsonb_build_object('version','observed-weekly-v1','ready',true,'asOf',current_date-1,'timezone','UTC','targetDay',current_date+6,'horizon',7,'anchor',80,'projected',80,'rawSlope',0,'recentSlope',0,'slope',0,'correction',0,'scenarios',jsonb_build_object('low',80,'high',80),'previousId','14000000-0000-4000-8000-000000000010','weeks','[{}, {}, {}, {}]'::jsonb,'inputs','{"weights":[],"balance":[]}'::jsonb);
  begin
    perform public.save_progress_projection(payload,'14000000-0000-4000-8000-000000000015','14000000-0000-4000-8000-000000000010');
    raise exception 'Se permitió encadenar historial ajeno';
  exception when raise_exception then if sqlerrm<>'El historial cambió; vuelve a consultar' then raise; end if; end;
  begin
    insert into public.progress_projections(user_id,as_of,timezone,method_version,operation_id,snapshot) values(auth.uid(),current_date-1,'UTC','observed-weekly-v1',gen_random_uuid(),'{}');
    raise exception 'Se permitió omitir la RPC';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin
    perform public.get_projection_data('UTC'); raise exception 'Se permitió lectura sin sesión';
  exception when raise_exception then if sqlerrm<>'Inicia sesión' then raise; end if; end;
end $$;
rollback;
