-- Optional, prospective research. No training, activation or access to other users.
begin;
create table public.weekly_research_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('training','evaluation')),
  granted boolean not null,
  policy_version text not null check (policy_version = 'weekly-consent-v1'),
  at timestamptz not null default clock_timestamp()
);
create index weekly_consent_owner on public.weekly_research_consents(user_id,purpose,at desc);
create table public.weekly_research_participants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  participant_id uuid not null unique default gen_random_uuid()
);
create table public.weekly_research_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  projection_id uuid not null unique references public.progress_projections(id) on delete cascade,
  training_consent uuid references public.weekly_research_consents(id),
  evaluation_consent uuid references public.weekly_research_consents(id),
  issued_at timestamptz not null,
  scope jsonb not null,
  frozen_inputs jsonb not null
);
alter table public.weekly_research_consents enable row level security;
alter table public.weekly_research_participants enable row level security;
alter table public.weekly_research_entries enable row level security;
create policy weekly_consents_owner on public.weekly_research_consents for select to authenticated using(user_id=auth.uid());
create policy weekly_participant_owner on public.weekly_research_participants for select to authenticated using(user_id=auth.uid());
create policy weekly_entries_owner on public.weekly_research_entries for select to authenticated using(user_id=auth.uid());
revoke all on public.weekly_research_consents, public.weekly_research_participants, public.weekly_research_entries from anon, authenticated;
grant select on public.weekly_research_consents, public.weekly_research_participants, public.weekly_research_entries to authenticated;

-- Operator-only append registry. A registry entry does not activate inference.
create table public.weekly_research_versions (
  version text primary key,
  predecessor text references public.weekly_research_versions(version),
  horizon_days int not null check(horizon_days=7),
  artifact_sha256 text not null check(artifact_sha256 ~ '^[0-9a-f]{64}$'),
  data_sha256 text not null check(data_sha256 ~ '^[0-9a-f]{64}$'),
  code_sha256 text not null check(code_sha256 ~ '^[0-9a-f]{64}$'),
  protocol jsonb not null,
  metrics jsonb not null,
  approval jsonb,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.weekly_research_versions enable row level security;
revoke all on public.weekly_research_versions from public,anon,authenticated;
grant select,insert on public.weekly_research_versions to service_role;
create function public.reject_weekly_version_edit() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Registra una nueva versión; el historial no es editable'; end $$;
create trigger immutable_weekly_version before update or delete on public.weekly_research_versions for each row execute function public.reject_weekly_version_edit();
revoke all on function public.reject_weekly_version_edit() from public,anon,authenticated;

create function public.set_weekly_research_consent(p_purpose text,p_granted boolean,p_policy text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); receipt uuid;
begin
  if owner_id is null then raise exception 'Inicia sesión'; end if;
  if p_purpose is null or p_purpose not in ('training','evaluation') or p_granted is null or p_policy is distinct from 'weekly-consent-v1' then raise exception 'Consentimiento no válido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,407));
  insert into public.weekly_research_consents(user_id,purpose,granted,policy_version) values(owner_id,p_purpose,p_granted,p_policy) returning id into receipt;
  -- Withdrawal removes prospective research copies, never original gym records.
  if not p_granted then delete from public.weekly_research_entries where user_id=owner_id; end if;
  return receipt;
end $$;

create function public.capture_weekly_research(p_projection uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); t uuid; e uuid; row_data public.progress_projections; profile public.progress_profiles; age_years int; result uuid; frozen jsonb;
begin
  if owner_id is null then raise exception 'Inicia sesión'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,407));
  select case when granted then id end into t from public.weekly_research_consents where user_id=owner_id and purpose='training' order by at desc,id desc limit 1;
  select case when granted then id end into e from public.weekly_research_consents where user_id=owner_id and purpose='evaluation' order by at desc,id desc limit 1;
  if t is null and e is null then raise exception 'Autoriza primero una finalidad'; end if;
  select * into row_data from public.progress_projections where id=p_projection and user_id=owner_id;
  if not found then raise exception 'Emisión propia no encontrada'; end if;
  if row_data.created_at < clock_timestamp()-interval '1 hour' or row_data.created_at>clock_timestamp() or row_data.method_version<>'observed-weekly-v2' or row_data.snapshot->>'ready' is distinct from 'true' then raise exception 'Emite una proyección vigente antes de participar'; end if;
  -- Consent must predate the frozen issue, not retrospectively authorize extraction.
  if t is not null and exists(select 1 from public.weekly_research_consents where id=t and at>row_data.created_at) then t:=null; end if;
  if e is not null and exists(select 1 from public.weekly_research_consents where id=e and at>row_data.created_at) then e:=null; end if;
  if t is null and e is null then raise exception 'Autoriza y después emite una nueva proyección'; end if;
  select * into profile from public.progress_profiles where user_id=owner_id;
  select extract(year from age((row_data.created_at at time zone profile.timezone)::date,fecha_nacimiento))::int into age_years from public.profiles where id=owner_id;
  if age_years is null or age_years not between 19 and 59 or profile.estimates_paused is distinct from false or profile.updated_at>row_data.created_at then raise exception 'Fuera del alcance del piloto'; end if;
  -- Allowlist: the original snapshot can contain goal.user_id; never export it.
  frozen:=jsonb_build_object('version',row_data.snapshot->'version','ready',row_data.snapshot->'ready','asOf',row_data.snapshot->'asOf','timezone',row_data.snapshot->'timezone','slope',row_data.snapshot->'slope',
    'inputs',jsonb_build_object('calculatedAt',row_data.snapshot#>'{inputs,calculatedAt}',
      'weights',(select coalesce(jsonb_agg(jsonb_build_object('weight_kg',w->'weight_kg','measured_at',w->'measured_at')),'[]'::jsonb) from jsonb_array_elements(row_data.snapshot#>'{inputs,weights}') w),
      'balance',(select coalesce(jsonb_agg(jsonb_build_object('day',b->'day','intake',b->'intake','expenditure',b->'expenditure','eligible',b->'eligible')),'[]'::jsonb) from jsonb_array_elements(row_data.snapshot#>'{inputs,balance}') b)));
  insert into public.weekly_research_participants(user_id) values(owner_id) on conflict do nothing;
  insert into public.weekly_research_entries(user_id,projection_id,training_consent,evaluation_consent,issued_at,scope,frozen_inputs)
  values(owner_id,p_projection,t,e,row_data.created_at,jsonb_build_object('age_at_issue',age_years,'formula_sex',profile.formula_sex,'activity_level',profile.activity_level,'estimates_paused',false),frozen)
  on conflict(projection_id) do nothing;
  select id into result from public.weekly_research_entries where projection_id=p_projection and user_id=owner_id;
  return result;
end $$;

create function public.export_weekly_research(p_purpose text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); receipt uuid; entries jsonb; weights jsonb; first_issue timestamptz; participant uuid;
begin
  if owner_id is null then raise exception 'Inicia sesión'; end if;
  if p_purpose is null or p_purpose not in ('training','evaluation') then raise exception 'Finalidad no válida'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,407));
  select case when granted then id end into receipt from public.weekly_research_consents where user_id=owner_id and purpose=p_purpose order by at desc,id desc limit 1;
  if receipt is null then raise exception 'Finalidad no autorizada'; end if;
  select participant_id into participant from public.weekly_research_participants where user_id=owner_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'issued_at',issued_at,'scope',scope,'frozen_inputs',frozen_inputs,
    'consent_id',receipt,'canonical_inputs_text',frozen_inputs::text,'inputs_sha256',encode(sha256(convert_to(frozen_inputs::text,'UTF8')),'hex')) order by issued_at),'[]'::jsonb),min(issued_at)
  into entries,first_issue from public.weekly_research_entries where user_id=owner_id and case when p_purpose='training' then training_consent else evaluation_consent end=receipt;
  -- Only outcome records inside the prospectively authorized observation windows.
  select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'weight_kg',w.weight_kg,'measured_at',w.measured_at,'created_at',w.created_at,'updated_at',w.updated_at)),'[]'::jsonb)
  into weights from public.weight_logs w where w.user_id=owner_id and first_issue is not null and exists(
    select 1 from public.weekly_research_entries r where r.user_id=owner_id
      and case when p_purpose='training' then r.training_consent else r.evaluation_consent end=receipt
      and (w.measured_at at time zone (r.frozen_inputs->>'timezone'))::date between
        (r.issued_at at time zone (r.frozen_inputs->>'timezone'))::date+6 and (r.issued_at at time zone (r.frozen_inputs->>'timezone'))::date+8);
  return jsonb_build_object('format','weekly-research-export-v1','policy_version','weekly-consent-v1','purpose',p_purpose,'exported_at',clock_timestamp(),'participant_id',participant,
    'consents',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'purpose',purpose,'granted',granted,'at',at,'policy_version',policy_version)),'[]'::jsonb) from public.weekly_research_consents where user_id=owner_id),
    'entries',entries,'weights',weights);
end $$;
revoke all on function public.set_weekly_research_consent(text,boolean,text), public.capture_weekly_research(uuid),public.export_weekly_research(text) from public,anon;
grant execute on function public.set_weekly_research_consent(text,boolean,text), public.capture_weekly_research(uuid),public.export_weekly_research(text) to authenticated;
commit;
