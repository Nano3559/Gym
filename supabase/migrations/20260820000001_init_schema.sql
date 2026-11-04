-- ============================================================================
-- Módulo 2 — Portal del Cliente y Reservas
-- Esquema de base de datos: profiles, plans, classes, bookings
-- Ejecutar en el SQL Editor de Supabase (orden 0001 → 0004).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- plans: catálogo de membresías (los precios/planes del Módulo 1, persistidos)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  descripcion text,
  precio numeric(10, 2) not null check (precio >= 0),
  duracion_dias integer not null default 30 check (duracion_dias > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles: perfil del cliente. El id está relacionado 1 a 1 con el usuario
-- de Supabase Auth (auth.users).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  apellido text not null,
  ci text unique,
  telefono text not null,
  fecha_nacimiento date,
  email text not null,
  direccion text,
  contacto_emergencia text,
  plan_id uuid references public.plans (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_email on public.profiles (email);

-- ---------------------------------------------------------------------------
-- classes: sesiones concretas de clase (una fila por fecha y horario).
-- reservas_count mantiene el número de reservas confirmadas (cupos en vivo);
-- lo actualizan los triggers definidos en 0003.
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time,
  capacidad integer not null check (capacidad > 0),
  entrenador text not null,
  activo boolean not null default true,
  reservas_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (nombre, fecha, hora_inicio)
);

create index if not exists idx_classes_fecha on public.classes (fecha);
create index if not exists idx_classes_activo_fecha on public.classes (fecha) where activo;

-- ---------------------------------------------------------------------------
-- bookings: reservas de los usuarios.
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  estado text not null default 'confirmada' check (estado in ('confirmada', 'cancelada')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

-- Un usuario no puede tener dos reservas activas para la misma clase.
create unique index if not exists uq_bookings_activa_por_clase
  on public.bookings (user_id, class_id)
  where estado = 'confirmada';

create index if not exists idx_bookings_user on public.bookings (user_id);
create index if not exists idx_bookings_class_estado on public.bookings (class_id) where estado = 'confirmada';

-- ---------------------------------------------------------------------------
-- Trigger: crea automáticamente el perfil base cuando un usuario se registra
-- en Supabase Auth (los datos vienen de user_metadata enviados por el form).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, email, nombre, apellido, ci, telefono,
    fecha_nacimiento, direccion, contacto_emergencia
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', 'Cliente'),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    new.raw_user_meta_data ->> 'ci',
    coalesce(new.raw_user_meta_data ->> 'telefono', ''),
    nullif(new.raw_user_meta_data ->> 'fecha_nacimiento', '')::date,
    new.raw_user_meta_data ->> 'direccion',
    new.raw_user_meta_data ->> 'contacto_emergencia'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
