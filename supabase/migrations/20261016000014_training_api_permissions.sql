-- Allow the authenticated API role to use the training tables.
-- These grants do not bypass RLS: each request still needs an applicable policy.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.routines to authenticated;
grant select, insert, update, delete on public.routine_exercises to authenticated;
grant select, insert, update, delete on public.routine_assignments to authenticated;
grant select, insert on public.routine_sessions to authenticated;
grant select, insert on public.meal_logs to authenticated;
