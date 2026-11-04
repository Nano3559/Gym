-- Base de pruebas con migraciones hasta 20. Transacción revertida.
begin;
insert into auth.users(id,email) values
('11000000-0000-4000-8000-000000000001','sprint1-a@example.invalid'),
('11000000-0000-4000-8000-000000000002','sprint1-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
insert into public.progress_profiles(user_id,height_cm,activity_level,timezone)
values(auth.uid(),175,'light','UTC');
create temporary table profile_token as select updated_at from public.progress_profiles where user_id=auth.uid();
update public.progress_profiles set estimates_paused=true where user_id=auth.uid();
do $$ begin
  update public.progress_profiles set height_cm=190 where user_id=auth.uid()
    and updated_at=(select updated_at from profile_token);
  if found then raise exception 'Token antiguo sobrescribió el perfil'; end if;
  if not (select estimates_paused from public.progress_profiles where user_id=auth.uid()) then
    raise exception 'No persistió pausa'; end if;
end $$;
insert into public.weight_logs(user_id,weight_kg,measured_at,timezone,local_date,operation_id)
values(auth.uid(),80,'2020-01-01','UTC','2020-01-01',gen_random_uuid()),
(auth.uid(),81,'2020-01-01','UTC','2020-01-01',gen_random_uuid());
update public.weight_logs set weight_kg=79 where user_id=auth.uid() and weight_kg=80;
delete from public.weight_logs where user_id=auth.uid() and weight_kg=79;
do $$ begin
  if (select count(*) from public.weight_logs)<>1 then raise exception 'No conservó medición repetida real'; end if;
  if (select count(*) from public.weight_log_revisions)<>2 then raise exception 'Falta auditoría'; end if;
  if not exists(select 1 from public.weight_log_revisions where action='UPDATE'
    and (before_record->>'weight_kg')::numeric=80 and (after_record->>'weight_kg')::numeric=79) then raise exception 'Auditoría incorrecta'; end if;
  begin
    delete from public.weight_log_revisions;
    raise exception 'Auditoría editable';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.progress_projections(user_id,as_of,timezone,method_version,operation_id,snapshot)
    values(auth.uid(),current_date,'UTC','observed-weekly-v1',gen_random_uuid(),'{}');
    raise exception 'Emisión directa admitida';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.weight_log_revisions) then raise exception 'Auditoría visible a otro usuario'; end if;
  update public.progress_profiles set estimates_paused=false;
  if found then raise exception 'Otro usuario quitó pausa'; end if;
end $$;
reset role;
-- Administrador: incluso insert directo a tabla respeta la pausa.
do $$ begin
  begin
    insert into public.progress_projections(user_id,as_of,timezone,method_version,operation_id,snapshot)
    values('11000000-0000-4000-8000-000000000001',current_date,'UTC','observed-weekly-v1',gen_random_uuid(),'{}');
    raise exception 'Pausa ignorada';
  exception when raise_exception then
    if sqlerrm<>'Las estimaciones están suspendidas en Mi progreso' then raise; end if;
  end;
end $$;
delete from auth.users where id='11000000-0000-4000-8000-000000000001';
do $$ begin
  if exists(select 1 from public.weight_log_revisions where user_id='11000000-0000-4000-8000-000000000001') then raise exception 'Cuenta eliminada retuvo auditoría'; end if;
end $$;
rollback;
