begin;
do $$
declare table_name text;
begin
  foreach table_name in array array['routines','routine_exercises','routine_assignments','routine_sessions','meal_logs'] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Missing training table: %',table_name;
    end if;
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=table_name and c.relrowsecurity) then
      raise exception 'RLS is disabled: %',table_name;
    end if;
    if not has_table_privilege('authenticated','public.' || table_name,'SELECT') then
      raise exception 'Authenticated API role lacks SELECT: %',table_name;
    end if;
    if not has_table_privilege('authenticated','public.' || table_name,'INSERT') then
      raise exception 'Authenticated API role lacks INSERT: %',table_name;
    end if;
  end loop;
  if to_regprocedure('public.create_training_routine(text,text,jsonb)') is null then
    raise exception 'Atomic routine creation function is missing';
  end if;
  if to_regprocedure('public.can_read_training_routine(uuid)') is null then
    raise exception 'Assigned routine access function is missing';
  end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"gym_role":"member"}}',true);
set local role authenticated;
do $$
begin
  if exists(select 1 from public.routines where not is_default and created_by is distinct from auth.uid()) then
    raise exception 'Member can read unrelated private routines';
  end if;
  if exists(select 1 from public.routine_sessions where user_id is distinct from auth.uid()) then
    raise exception 'Member can read another user''s sessions';
  end if;
  if exists(select 1 from public.meal_logs where user_id is distinct from auth.uid()) then
    raise exception 'Member can read another user''s meals';
  end if;
  begin
    insert into public.routines(title,created_by) values('RLS verification - rolled back',auth.uid());
    raise exception 'Member was allowed to create a trainer routine';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'training_database_checks_passed' as result;
