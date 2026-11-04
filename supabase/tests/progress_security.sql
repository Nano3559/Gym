-- Ejecutar en una base de pruebas con todas las migraciones aplicadas.
-- Transacción revertida; no usa usuarios reales.
begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','progress-a@example.invalid'),('10000000-0000-4000-8000-000000000002','progress-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.progress_profiles(user_id,height_cm,activity_level,timezone)
values(auth.uid(),175,'light','America/La_Paz');
insert into public.weight_logs(user_id,weight_kg,measured_at,timezone,local_date,operation_id)
values(auth.uid(),80,'2020-01-02 01:00Z','America/La_Paz','2020-01-02','20000000-0000-4000-8000-000000000001');
select public.set_weight_goal(75,'30000000-0000-4000-8000-000000000001');
select public.set_weight_goal(74,'30000000-0000-4000-8000-000000000002');
select public.set_weight_goal(75,'30000000-0000-4000-8000-000000000001');
do $$ begin
  if (select count(*) from public.weight_goals) <> 2 then raise exception 'Reintento duplicó metas'; end if;
  if (select target_weight_kg from public.weight_goals where ended_at is null) <> 74 then raise exception 'Reintento reactivó una meta antigua'; end if;
  if (select local_date from public.weight_logs limit 1) <> '2020-01-01'::date then raise exception 'Día local incorrecto'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.progress_profiles) or exists(select 1 from public.weight_logs) or exists(select 1 from public.weight_goals) then raise exception 'Datos visibles a otro usuario'; end if;
  update public.weight_logs set weight_kg=90;
  if found then raise exception 'Otro usuario modificó un pesaje'; end if;
  delete from public.weight_logs;
  if found then raise exception 'Otro usuario eliminó un pesaje'; end if;
  begin
    insert into public.progress_profiles(user_id,height_cm,activity_level,timezone)
    values('10000000-0000-4000-8000-000000000001',180,'high','UTC');
    raise exception 'Se permitió suplantar propietario';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
update public.weight_logs set weight_kg=79;
do $$ begin
  if (select weight_kg from public.weight_logs limit 1) <> 79 then raise exception 'Falló corrección propia'; end if;
  begin
    insert into public.weight_logs(user_id,weight_kg,measured_at,timezone,local_date,operation_id)
    values(auth.uid(),80,now()+interval '1 day','UTC',current_date,gen_random_uuid());
    raise exception 'Se aceptó fecha futura';
  exception when raise_exception then
    if sqlerrm <> 'El pesaje no puede estar en el futuro' then raise; end if;
  end;
end $$;
delete from public.weight_logs;
do $$ begin if exists(select 1 from public.weight_logs) then raise exception 'Falló eliminación propia'; end if; end $$;
rollback;
