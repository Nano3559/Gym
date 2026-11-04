-- Requiere migraciones 1–18. Usar en una base de pruebas; todo se revierte.
begin;
insert into auth.users(id,email) values('13000000-0000-4000-8000-000000000001','balance-a@example.invalid'),('13000000-0000-4000-8000-000000000002','balance-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
insert into public.meal_logs(user_id,alimento,calorias,consumed_at)
select auth.uid(),'Ejemplo '||n,100,'2020-01-02 12:00Z'::timestamptz from generate_series(1,1001) n;
do $$ declare result jsonb; begin
  result:=public.get_balance_data('2020-01-02','2020-01-02','UTC');
  if jsonb_array_length(result->'meals')<>1001 then raise exception 'La lectura truncó las comidas'; end if;
  if result->>'read_at' is null then raise exception 'Falta fecha de lectura'; end if;
end $$;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
do $$ declare result jsonb; begin
  result:=public.get_balance_data('2020-01-02','2020-01-02','UTC');
  if jsonb_array_length(result->'meals')<>0 or jsonb_array_length(result->'weights')<>0 or jsonb_array_length(result->'sessions')<>0 or jsonb_array_length(result->'estimates')<>0 then raise exception 'Se leyeron datos de otro usuario'; end if;
  begin
    perform public.get_balance_data('2020-01-01','2020-02-01','UTC');
    raise exception 'Se aceptó un periodo excesivo';
  exception when raise_exception then if sqlerrm<>'Selecciona un periodo de 1 a 31 días' then raise; end if; end;
  begin
    perform public.get_balance_data('2020-01-01','2020-01-02','Zona/Inexistente');
    raise exception 'Se aceptó zona inválida';
  exception when raise_exception then if sqlerrm<>'Zona horaria no válida' then raise; end if; end;
end $$;
rollback;
