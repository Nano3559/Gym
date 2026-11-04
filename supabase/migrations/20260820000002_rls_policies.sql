-- ============================================================================
-- Módulo 2 — Row Level Security (RLS) y policies
--
-- Un usuario autenticado puede:
--   * consultar su propio perfil
--   * crear, consultar y cancelar sus propias reservas
-- Un usuario NO puede:
--   * consultar o modificar reservas de otros usuarios
--   * eliminar perfiles (ni propios ni ajenos)
-- Las clases y el catálogo de planes son de lectura pública.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.plans   enable row level security;
alter table public.classes enable row level security;
alter table public.bookings enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "Leer perfil propio" on public.profiles;
create policy "Leer perfil propio"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Crear perfil propio" on public.profiles;
create policy "Crear perfil propio"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Actualizar perfil propio" on public.profiles;
create policy "Actualizar perfil propio"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Sin policy de DELETE: los clientes nunca eliminan perfiles.

-- ---------------------------------------------------------------------------
-- plans: catálogo público (solo planes activos). Se consulta antes del signup
-- para resolver el plan elegido en el formulario de registro.
-- ---------------------------------------------------------------------------
drop policy if exists "Catalogo de planes publico" on public.plans;
create policy "Catalogo de planes publico"
  on public.plans for select
  using (activo = true);

-- ---------------------------------------------------------------------------
-- classes: las clases disponibles pueden consultarse incluso sin sesión.
-- ---------------------------------------------------------------------------
drop policy if exists "Clases disponibles publicas" on public.classes;
create policy "Clases disponibles publicas"
  on public.classes for select
  using (true);

-- ---------------------------------------------------------------------------
-- bookings: estrictamente privadas por usuario.
-- ---------------------------------------------------------------------------
drop policy if exists "Leer reservas propias" on public.bookings;
create policy "Leer reservas propias"
  on public.bookings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Crear reservas propias" on public.bookings;
create policy "Crear reservas propias"
  on public.bookings for insert
  to authenticated
  with check (auth.uid() = user_id and estado = 'confirmada');

drop policy if exists "Actualizar reservas propias" on public.bookings;
create policy "Actualizar reservas propias"
  on public.bookings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sin policy de DELETE: cancelar cambia el estado, no borra el historial.
