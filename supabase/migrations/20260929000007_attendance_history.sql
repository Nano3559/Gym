create table if not exists public.asistencia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  hora time not null default localtime,
  plan text,
  created_at timestamptz not null default now()
);

create index if not exists idx_asistencia_user_fecha
  on public.asistencia (user_id, fecha desc, hora desc);

alter table public.asistencia enable row level security;

drop policy if exists "Personal puede leer historial de asistencia" on public.asistencia;
create policy "Personal puede leer historial de asistencia"
  on public.asistencia for select
  to authenticated
  using ((auth.jwt() ->> 'email') in ('recepcion@ironforge.com', 'admin@ironforge.com'));

drop policy if exists "Personal puede registrar asistencia" on public.asistencia;
create policy "Personal puede registrar asistencia"
  on public.asistencia for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') in ('recepcion@ironforge.com', 'admin@ironforge.com'));