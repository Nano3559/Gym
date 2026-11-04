-- Prueba transaccional; ejecutar en base de pruebas con migraciones 1–16 aplicadas.
begin;
insert into auth.users(id,email) values('11000000-0000-4000-8000-000000000001','diary-a@example.invalid'),('11000000-0000-4000-8000-000000000002','diary-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select public.set_tracking_day('2020-01-01','UTC',true,true);
insert into public.meal_logs(user_id,alimento,calorias,consumed_at,timezone,source,confirmation,portion,portions,nutrition_per_portion,operation_id)
values(auth.uid(),'Prueba',1,'2020-01-01 12:00Z','UTC','manual','confirmed','100 g',2,'{"calorias":120,"proteinas_g":3,"carbohidratos_g":20,"grasas_g":1}','21000000-0000-4000-8000-000000000001');
do $$ begin
  if (select calorias from public.meal_logs limit 1) <> 240 then raise exception 'Total no calculado en servidor'; end if;
  if (select meals_complete from public.daily_tracking_status limit 1) then raise exception 'Completitud no invalidada'; end if;
  if not (select activity_complete from public.daily_tracking_status limit 1) then raise exception 'Se invalidó otro campo'; end if;
end $$;
update public.meal_logs set portions=1;
do $$ begin if (select calorias from public.meal_logs limit 1) <> 120 then raise exception 'Corrección incorrecta'; end if; end $$;
insert into public.meal_logs(user_id,alimento,calorias,consumed_at,operation_id)
values(auth.uid(),'Antigua',900,'2020-01-01 12:00Z',gen_random_uuid());
do $$ begin if (select count(*) from public.meal_logs where confirmation='confirmed') <> 1 then raise exception 'Se confirmó una comida antigua'; end if; end $$;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.meal_logs) or exists(select 1 from public.daily_tracking_status) then raise exception 'Fuga entre usuarios'; end if;
  update public.meal_logs set confirmation='void';
  if found then raise exception 'Otro usuario alteró una comida'; end if;
  begin
    insert into public.daily_tracking_status(user_id,local_date,timezone)
    values('11000000-0000-4000-8000-000000000001','2020-01-01','UTC');
    raise exception 'Suplantación permitida';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
insert into public.routine_sessions(user_id,routine_title,duration_sec,started_at,completed_at,timezone,session_status,active_sec,rest_sec,paused_sec,preparation_sec,operation_id)
values(auth.uid(),'Parcial',60,'2020-01-01 12:00Z','2020-01-01 12:01Z','UTC','partial',30,15,10,5,'31000000-0000-4000-8000-000000000001');
do $$ begin
  if (select activity_complete from public.daily_tracking_status limit 1) then raise exception 'Actividad completa no invalidada'; end if;
  begin
    insert into public.routine_sessions(user_id,routine_title,duration_sec,started_at,completed_at,timezone,session_status,active_sec,rest_sec,paused_sec,preparation_sec,operation_id)
    values(auth.uid(),'Inconsistente',60,'2020-01-01 12:00Z','2020-01-01 12:01Z','UTC','manual',120,0,0,0,gen_random_uuid());
    raise exception 'Aceptó duración inconsistente';
  exception when raise_exception then if sqlerrm <> 'Duraciones inconsistentes' then raise; end if; end;
end $$;
rollback;
