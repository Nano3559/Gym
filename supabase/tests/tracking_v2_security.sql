-- Base de pruebas con migraciones hasta 21. No ejecutar en producción.
begin;
insert into auth.users(id,email) values
('12000000-0000-4000-8000-000000000001','tracking-v2-a@example.invalid'),
('12000000-0000-4000-8000-000000000002','tracking-v2-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select public.set_tracking_day('2020-01-01','UTC',true,true);
select public.set_tracking_day('2019-12-31','America/La_Paz',true,true);
insert into public.meal_logs(user_id,alimento,calorias,consumed_at,timezone,source,confirmation,portion,portions,nutrition_per_portion,operation_id)
values(auth.uid(),'Pan',100,'2020-01-01 02:00Z','UTC','scan','confirmed','Una rebanada',1,
'{"calorias":100,"proteinas_g":2,"carbohidratos_g":20,"grasas_g":1}','22000000-0000-4000-8000-000000000001');
do $$ begin
  if exists(select 1 from public.daily_tracking_status where meals_complete) then raise exception 'No invalidó todas las zonas'; end if;
  if exists(select 1 from public.daily_tracking_status where not activity_complete) then raise exception 'Invalidó actividad por comida'; end if;
end $$;
select public.set_tracking_day('2020-01-01','UTC',true,null);
select public.set_tracking_day('2019-12-31','America/La_Paz',true,null);
select public.set_tracking_day('2020-01-02','UTC',true,true);
select public.set_tracking_day('2020-01-01','America/La_Paz',true,true);
create temporary table meal_token as select updated_at from public.meal_logs where user_id=auth.uid();
update public.meal_logs set consumed_at='2020-01-02 02:00Z',source='manual',portions=2;
do $$ begin
  if exists(select 1 from public.daily_tracking_status where meals_complete) then raise exception 'No invalidó fecha antigua y nueva'; end if;
  if (select source from public.meal_logs limit 1)<>'scan' then raise exception 'Cambió origen del escáner'; end if;
  if not exists(select 1 from public.tracking_revisions where action='UPDATE'
    and before_record->>'source'='scan' and (after_record->>'calorias')::numeric=200) then raise exception 'No conservó corrección'; end if;
  update public.meal_logs set portions=3 where updated_at=(select updated_at from meal_token);
  if found then raise exception 'Token antiguo admitido'; end if;
  begin
    delete from public.tracking_revisions;
    raise exception 'Auditoría editable';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.tracking_revisions) then raise exception 'Auditoría ajena visible'; end if;
  update public.meal_logs set portions=10;
  if found then raise exception 'Otro usuario alteró comida'; end if;
end $$;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select public.set_tracking_day('2020-01-02','UTC',true,null);
reset role;
delete from public.meal_logs where user_id='12000000-0000-4000-8000-000000000001';
do $$ begin
  if (select meals_complete from public.daily_tracking_status where user_id='12000000-0000-4000-8000-000000000001' and timezone='UTC' and local_date='2020-01-02') then raise exception 'Eliminación no invalidó día'; end if;
  if not exists(select 1 from public.tracking_revisions where action='DELETE' and user_id='12000000-0000-4000-8000-000000000001') then raise exception 'Eliminación sin auditoría'; end if;
end $$;
delete from auth.users where id='12000000-0000-4000-8000-000000000001';
do $$ begin
  if exists(select 1 from public.tracking_revisions where user_id='12000000-0000-4000-8000-000000000001') then raise exception 'Cuenta eliminada retuvo datos'; end if;
end $$;
rollback;
