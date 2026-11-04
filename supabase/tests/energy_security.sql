-- Ejecutar en una base de pruebas con migraciones 1–17. No modifica datos reales.
begin;
insert into auth.users(id,email) values('12000000-0000-4000-8000-000000000001','energy-a@example.invalid'),('12000000-0000-4000-8000-000000000002','energy-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
insert into public.routine_sessions(id,user_id,routine_title,duration_sec) values('22000000-0000-4000-8000-000000000001',auth.uid(),'Ejemplo',0);
insert into public.energy_activity_annotations(session_id,user_id,activity_code) values('22000000-0000-4000-8000-000000000001',auth.uid(),'02054');
insert into public.daily_energy_estimates(user_id,local_date,timezone,method_version,operation_id,snapshot)
values(auth.uid(),'2020-01-01','UTC','mifflin-met-replacement-v1','32000000-0000-4000-8000-000000000001','{"version":"mifflin-met-replacement-v1","day":"2020-01-01","timezone":"UTC","base":2000,"exercise":100,"total":2100,"inputs":{}}');
do $$ begin
  begin
    update public.daily_energy_estimates set snapshot='{}';
    raise exception 'Se permitió reescribir una estimación';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.energy_activity_annotations) or exists(select 1 from public.daily_energy_estimates) then raise exception 'Fuga entre usuarios'; end if;
  begin
    insert into public.energy_activity_annotations(session_id,user_id,activity_code) values('22000000-0000-4000-8000-000000000001',auth.uid(),'02022');
    raise exception 'Se anotó una sesión ajena';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
