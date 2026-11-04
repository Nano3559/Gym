-- Mi progreso reads the account birth date in addition to progress_profiles.
-- Earlier migrations defined owner RLS but relied on default table grants.
begin;
grant usage on schema public to authenticated;
grant select (id, fecha_nacimiento) on public.profiles to authenticated;
grant update (fecha_nacimiento) on public.profiles to authenticated;
-- Existing owner/staff policies still filter every request.
commit;
