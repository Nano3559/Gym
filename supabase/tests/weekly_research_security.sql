-- Disposable local PostgreSQL with migrations through 24. Never run on gym data.
-- Integration assertions, not counted by the web runner. All fixtures roll back.
begin;
insert into auth.users(id,email) values
('18000000-0000-4000-8000-000000000001','weekly-a@example.invalid'),
('18000000-0000-4000-8000-000000000002','weekly-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    perform public.export_weekly_research('training');
    raise exception 'Export without consent';
  exception when raise_exception then if sqlerrm<>'Finalidad no autorizada' then raise; end if; end;
  begin
    perform public.set_weekly_research_consent('training',true,'old-policy');
    raise exception 'Old policy accepted';
  exception when raise_exception then if sqlerrm<>'Consentimiento no válido' then raise; end if; end;
  begin
    insert into public.weekly_research_consents(user_id,purpose,granted,policy_version)
      values(auth.uid(),'training',true,'weekly-consent-v1');
    raise exception 'Direct consent write allowed';
  exception when insufficient_privilege then null; end;
end $$;
select public.set_weekly_research_consent('training',true,'weekly-consent-v1');
do $$ declare payload jsonb; begin
  payload:=public.export_weekly_research('training');
  if payload->>'purpose'<>'training' or jsonb_array_length(payload->'entries')<>0 then raise exception 'Incorrect empty export'; end if;
  if payload ? 'user_id' or payload ? 'email' then raise exception 'PII exported'; end if;
  begin
    perform public.export_weekly_research('evaluation'); raise exception 'Purposes not separated';
  exception when raise_exception then if sqlerrm<>'Finalidad no autorizada' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.weekly_research_consents) or exists(select 1 from public.weekly_research_entries) then raise exception 'Cross-user read'; end if;
  begin
    perform public.capture_weekly_research('18000000-0000-4000-8000-000000000010');
    raise exception 'Capture without consent';
  exception when raise_exception then if sqlerrm<>'Autoriza primero una finalidad' then raise; end if; end;
end $$;
select public.set_weekly_research_consent('evaluation',true,'weekly-consent-v1');
do $$ begin
  begin
    perform public.capture_weekly_research('18000000-0000-4000-8000-000000000010');
    raise exception 'Foreign or absent projection accepted';
  exception when raise_exception then if sqlerrm<>'Emisión propia no encontrada' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000001',true);
select public.set_weekly_research_consent('training',false,'weekly-consent-v1');
do $$ begin
  if exists(select 1 from public.weekly_research_entries) then raise exception 'Withdrawal retained copies'; end if;
  if (select count(*) from public.weekly_research_consents)<>2 then raise exception 'Receipt audit missing'; end if;
  begin
    perform public.export_weekly_research('training');raise exception 'Withdrawal ignored';
  exception when raise_exception then if sqlerrm<>'Finalidad no autorizada' then raise; end if; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.export_weekly_research('training');raise exception 'Anonymous export allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
