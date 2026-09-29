-- Allow the authorized reception and admin accounts to manage client profiles,
-- inspect payment history, and freeze memberships from the staff panel.

alter table public.memberships
  drop constraint if exists memberships_estado_check;

alter table public.memberships
  add constraint memberships_estado_check
  check (estado in ('activa', 'por_vencer', 'vencida', 'cancelada', 'congelada'));

drop policy if exists "Personal puede leer perfiles" on public.profiles;
create policy "Personal puede leer perfiles"
  on public.profiles for select
  to authenticated
  using ((auth.jwt() ->> 'email') in ('recepcion@ironforge.com', 'admin@ironforge.com'));

drop policy if exists "Personal puede actualizar perfiles" on public.profiles;
create policy "Personal puede actualizar perfiles"
  on public.profiles for update
  to authenticated
  using ((auth.jwt() ->> 'email') in ('recepcion@ironforge.com', 'admin@ironforge.com'))
  with check ((auth.jwt() ->> 'email') in ('recepcion@ironforge.com', 'admin@ironforge.com'));

drop policy if exists "Personal puede leer membresias" on public.memberships;
create policy "Personal puede leer membresias"
  on public.memberships for select
  to authenticated
  using ((auth.jwt() ->> 'email') in ('recepcion@ironforge.com', 'admin@ironforge.com'));

drop policy if exists "Personal puede congelar membresias" on public.memberships;
create policy "Personal puede congelar membresias"
  on public.memberships for update
  to authenticated
  using ((auth.jwt() ->> 'email') in ('recepcion@ironforge.com', 'admin@ironforge.com'))
  with check ((auth.jwt() ->> 'email') in ('recepcion@ironforge.com', 'admin@ironforge.com'));

drop policy if exists "Personal puede leer pagos de clientes" on public.payments;
create policy "Personal puede leer pagos de clientes"
  on public.payments for select
  to authenticated
  using ((auth.jwt() ->> 'email') in ('recepcion@ironforge.com', 'admin@ironforge.com'));